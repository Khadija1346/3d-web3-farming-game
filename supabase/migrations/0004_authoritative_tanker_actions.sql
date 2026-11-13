-- Server-authoritative tanker actions for the river water district.
create or replace function public.apply_garriverse_utility_action(
  p_user_id uuid,
  p_action_type text,
  p_plot_id integer,
  p_idempotency_key text,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state jsonb;
  v_plots jsonb;
  v_plot jsonb;
  v_revision bigint;
  v_result jsonb;
  v_existing jsonb;
  v_tanker integer;
  v_gain integer := 0;
  v_total_xp bigint;
  v_new_xp bigint;
  v_level integer;
  v_new_level integer;
  v_needed integer;
  v_last_tick timestamptz;
  v_elapsed numeric;
  v_water numeric;
  v_weeds numeric;
  v_growth numeric;
  v_active_seconds numeric;
  v_average_weeds numeric;
  i integer;
begin
  if p_user_id is null or p_action_type is null or p_action_type not in ('water_tanker','refill_tanker') then
    raise exception using errcode='22023',message='invalid_action';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key)<8 or length(p_idempotency_key)>128 then
    raise exception using errcode='22023',message='invalid_idempotency_key';
  end if;
  if p_action_type='water_tanker' and (p_plot_id is null or p_plot_id<0 or p_plot_id>11) then
    raise exception using errcode='22023',message='invalid_plot';
  end if;

  select result into v_existing from public.game_action_events
  where user_id=p_user_id and idempotency_key=p_idempotency_key;
  if found then return v_existing || jsonb_build_object('duplicate',true); end if;

  select state,revision into v_state,v_revision
  from public.player_game_states where user_id=p_user_id for update;
  if not found then raise exception using errcode='P0002',message='player_state_missing'; end if;

  select result into v_existing from public.game_action_events
  where user_id=p_user_id and idempotency_key=p_idempotency_key;
  if found then return v_existing || jsonb_build_object('duplicate',true); end if;

  if p_expected_revision is not null and p_expected_revision<>v_revision then
    raise exception using errcode='40001',message='revision_conflict';
  end if;

  v_plots:=v_state->'plots';
  if coalesce(jsonb_typeof(v_plots)<>'array',true) or jsonb_array_length(v_plots)<>12 then
    raise exception using errcode='22023',message='player_state_not_initialized';
  end if;

  -- Apply elapsed crop growth on the server before the tanker action.
  v_last_tick:=coalesce((v_state->>'lastSimulatedAt')::timestamptz,clock_timestamp());
  v_elapsed:=greatest(0,least(3600,extract(epoch from (clock_timestamp()-v_last_tick))));
  for i in 0..11 loop
    v_plot:=v_plots->i;
    if v_plot->>'stage'='planted' and v_elapsed>0 then
      v_water:=coalesce((v_plot->>'water')::numeric,0);
      v_weeds:=coalesce((v_plot->>'weeds')::numeric,0);
      v_active_seconds:=least(v_elapsed,v_water*55.0);
      v_average_weeds:=least(1,v_weeds+(v_active_seconds/110.0)/2.0);
      v_growth:=least(1,coalesce((v_plot->>'growth')::numeric,0)+(v_active_seconds/90.0)*(1-v_average_weeds*0.7));
      v_water:=greatest(0,v_water-v_elapsed/55.0);
      v_weeds:=least(1,v_weeds+v_elapsed/110.0);
      if v_growth>=1 then v_plot:=jsonb_set(v_plot,'{stage}','"mature"'::jsonb); end if;
      v_plot:=jsonb_set(v_plot,'{growth}',to_jsonb(v_growth));
      v_plot:=jsonb_set(v_plot,'{water}',to_jsonb(v_water));
      v_plot:=jsonb_set(v_plot,'{weeds}',to_jsonb(v_weeds));
      v_plots:=jsonb_set(v_plots,array[i::text],v_plot,false);
    end if;
  end loop;
  v_state:=jsonb_set(v_state,'{plots}',v_plots,true);
  v_state:=jsonb_set(v_state,'{lastSimulatedAt}',to_jsonb(clock_timestamp()),true);

  case p_action_type
    when 'water_tanker' then
      v_plot:=v_plots->p_plot_id;
      if v_plot->>'stage'<>'planted' then raise exception using errcode='22023',message='plot_not_planted'; end if;
      if coalesce((v_plot->>'water')::numeric,0)>0.85 then raise exception using errcode='22023',message='plot_does_not_need_water'; end if;
      v_tanker:=coalesce((v_state->>'tankerWater')::integer,0);
      if v_tanker<10 then raise exception using errcode='22023',message='tanker_empty'; end if;
      v_state:=jsonb_set(v_state,'{tankerWater}',to_jsonb(v_tanker-10),true);
      v_plot:=jsonb_set(v_plot,'{water}','1'::jsonb);
      v_plots:=jsonb_set(v_plots,array[p_plot_id::text],v_plot,false);
      v_state:=jsonb_set(v_state,'{plots}',v_plots,true);
      v_gain:=3;
    when 'refill_tanker' then
      v_tanker:=coalesce((v_state->>'tankerWater')::integer,0);
      if v_tanker>=100 then raise exception using errcode='22023',message='tanker_full'; end if;
      v_state:=jsonb_set(v_state,'{tankerWater}','100'::jsonb,true);
  end case;

  v_total_xp:=coalesce((v_state->>'totalXp')::bigint,0)+v_gain;
  v_new_xp:=coalesce((v_state->>'xp')::bigint,0)+v_gain;
  v_level:=greatest(1,coalesce((v_state->>'level')::integer,1));
  v_new_level:=v_level;
  loop
    v_needed:=100+(v_new_level-1)*60;
    exit when v_new_xp<v_needed;
    v_new_xp:=v_new_xp-v_needed;
    v_new_level:=v_new_level+1;
  end loop;
  v_state:=jsonb_set(v_state,'{totalXp}',to_jsonb(v_total_xp),true);
  v_state:=jsonb_set(v_state,'{xp}',to_jsonb(v_new_xp),true);
  v_state:=jsonb_set(v_state,'{level}',to_jsonb(v_new_level),true);

  update public.player_game_states set state=v_state,revision=revision+1,updated_at=now()
  where user_id=p_user_id returning revision into v_revision;
  update public.player_profiles set xp=v_total_xp,level=v_new_level where user_id=p_user_id;
  v_result:=jsonb_build_object('state',v_state,'revision',v_revision,'xp_gain',v_gain,'level',v_new_level,'duplicate',false);
  insert into public.game_action_events(user_id,action_type,idempotency_key,payload,result)
  values(p_user_id,p_action_type,p_idempotency_key,jsonb_build_object('plot_id',p_plot_id,'expected_revision',p_expected_revision),v_result);
  return v_result;
end;
$$;

revoke all on function public.apply_garriverse_utility_action(uuid,text,integer,text,bigint) from public,anon,authenticated;
grant execute on function public.apply_garriverse_utility_action(uuid,text,integer,text,bigint) to service_role;
