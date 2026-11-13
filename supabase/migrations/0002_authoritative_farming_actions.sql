-- GARRIVERSE authoritative farming command foundation.
-- The service-role-only RPC is the sole writer; browser clients never submit snapshots/rewards.
create or replace function public.apply_garriverse_action(
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
  v_stems integer;
  v_water integer;
  v_roots integer;
  v_xp bigint;
  v_level integer;
  v_gain integer := 0;
  v_new_xp bigint;
  v_new_level integer;
  v_needed integer;
  v_roots_yield integer;
  v_last_tick timestamptz;
  v_elapsed numeric;
  v_growth numeric;
  v_water_level numeric;
  v_active_seconds numeric;
  v_average_weeds numeric;
  v_initial_weeds numeric;
  v_weeds numeric;
  v_total_xp bigint;
begin
  if p_user_id is null or p_action_type is null or p_action_type not in ('till','plant','water','weed','harvest') then
    raise exception using errcode = '22023', message = 'invalid_action';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 or length(p_idempotency_key) > 128 then
    raise exception using errcode = '22023', message = 'invalid_idempotency_key';
  end if;
  if p_plot_id is null or p_plot_id < 0 or p_plot_id > 11 then
    raise exception using errcode = '22023', message = 'invalid_plot';
  end if;

  -- A retry returns the original result without applying the action twice.
  select result into v_existing
  from public.game_action_events
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    return v_existing || jsonb_build_object('duplicate', true);
  end if;

  select state, revision into v_state, v_revision
  from public.player_game_states
  where user_id = p_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'player_state_missing';
  end if;
  -- Recheck after the row lock: concurrent retries with the same key may have waited here.
  select result into v_existing
  from public.game_action_events
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    return v_existing || jsonb_build_object('duplicate', true);
  end if;

  if p_expected_revision is not null and p_expected_revision <> v_revision then
    raise exception using errcode = '40001', message = 'revision_conflict';
  end if;

  -- Initialize an empty state without accepting any client-provided snapshot.
  if coalesce(jsonb_typeof(v_state->'plots') <> 'array', true) or coalesce(jsonb_array_length(v_state->'plots') <> 12, true) then
    select jsonb_agg(jsonb_build_object(
      'id', n, 'stage', 'wild', 'growth', 0, 'water', 0, 'weeds', 0
    ) order by n) into v_plots
    from generate_series(0,11) as n;
    v_state := jsonb_build_object(
      'plots', v_plots, 'stems', 12, 'roots', 0, 'garriCarried', 0,
      'garriStored', 0, 'naira', 500, 'waterCan', 5, 'tankerWater', 100,
      'xp', 0, 'totalXp', 0, 'level', 1,
      'lastSimulatedAt', now(),
      'stats', jsonb_build_object('harvested',0,'bagsMade',0,'plotsTilled',0)
    );
  end if;

  -- Advance crop growth using server elapsed time; browser timers are never trusted.
  v_last_tick := coalesce((v_state->>'lastSimulatedAt')::timestamptz, now());
  v_elapsed := greatest(0, least(3600, extract(epoch from (now() - v_last_tick))));
  v_plots := v_state->'plots';
  for v_roots in 0..jsonb_array_length(v_plots)-1 loop
    v_plot := v_plots->v_roots;
    if v_plot->>'stage' = 'planted' and v_elapsed > 0 then
      v_water_level := coalesce((v_plot->>'water')::numeric,0);
      v_initial_weeds := coalesce((v_plot->>'weeds')::numeric,0);
      v_active_seconds := least(v_elapsed, v_water_level * 55.0);
      v_average_weeds := least(1, v_initial_weeds + (v_active_seconds / 110.0) / 2.0);
      v_weeds := least(1, v_initial_weeds + v_elapsed / 110.0);
      v_growth := least(1, coalesce((v_plot->>'growth')::numeric,0) + (v_active_seconds / 90.0) * (1 - v_average_weeds * 0.7));
      v_water_level := greatest(0, v_water_level - v_elapsed / 55.0);
      if v_growth >= 1 then
        v_plot := jsonb_set(v_plot,'{stage}','"mature"');
      end if;
      v_plot := jsonb_set(v_plot,'{growth}',to_jsonb(v_growth));
      v_plot := jsonb_set(v_plot,'{water}',to_jsonb(v_water_level));
      v_plot := jsonb_set(v_plot,'{weeds}',to_jsonb(v_weeds));
      v_plots := jsonb_set(v_plots,array[v_roots::text],v_plot,false);
    end if;
  end loop;
  v_state := jsonb_set(v_state,'{plots}',v_plots,true);
  v_state := jsonb_set(v_state,'{lastSimulatedAt}',to_jsonb(now()),true);
  v_plot := v_plots->p_plot_id;
  if v_plot is null then
    raise exception using errcode = '22023', message = 'invalid_plot';
  end if;

  case p_action_type
    when 'till' then
      if v_plot->>'stage' <> 'wild' then raise exception using errcode='22023', message='plot_not_wild'; end if;
      v_plot := jsonb_set(v_plot,'{stage}','"tilled"');
      v_plot := jsonb_set(v_plot,'{growth}','0'::jsonb);
      v_plot := jsonb_set(v_plot,'{water}','0'::jsonb);
      v_plot := jsonb_set(v_plot,'{weeds}','0'::jsonb);
      v_gain := 4;
      v_state := jsonb_set(v_state,'{stats,plotsTilled}',to_jsonb(coalesce((v_state#>>'{stats,plotsTilled}')::integer,0)+1),true);
    when 'plant' then
      if v_plot->>'stage' <> 'tilled' then raise exception using errcode='22023', message='plot_not_tilled'; end if;
      v_stems := coalesce((v_state->>'stems')::integer,12);
      if v_stems < 1 then raise exception using errcode='22023', message='no_stems'; end if;
      v_state := jsonb_set(v_state,'{stems}',to_jsonb(v_stems-1),true);
      v_plot := jsonb_set(v_plot,'{stage}','"planted"');
      v_plot := jsonb_set(v_plot,'{growth}','0.02'::jsonb);
      v_plot := jsonb_set(v_plot,'{water}','0.25'::jsonb);
      v_plot := jsonb_set(v_plot,'{weeds}','0'::jsonb);
      v_gain := 6;
    when 'water' then
      if v_plot->>'stage' <> 'planted' then raise exception using errcode='22023', message='plot_not_planted'; end if;
      if coalesce((v_plot->>'water')::numeric,0) > 0.85 then raise exception using errcode='22023', message='plot_does_not_need_water'; end if;
      v_water := coalesce((v_state->>'waterCan')::integer,5);
      if v_water < 1 then raise exception using errcode='22023', message='watering_can_empty'; end if;
      v_state := jsonb_set(v_state,'{waterCan}',to_jsonb(v_water-1),true);
      v_plot := jsonb_set(v_plot,'{water}','1'::jsonb);
      v_gain := 3;
    when 'weed' then
      if v_plot->>'stage' <> 'planted' or coalesce((v_plot->>'weeds')::numeric,0) < 0.25 then
        raise exception using errcode='22023', message='weeding_not_available';
      end if;
      v_plot := jsonb_set(v_plot,'{weeds}','0'::jsonb);
      v_gain := 4;
    when 'harvest' then
      if v_plot->>'stage' <> 'mature' then raise exception using errcode='22023', message='crop_not_mature'; end if;
      v_roots_yield := 6 + floor(random()*4)::integer;
      v_state := jsonb_set(v_state,'{roots}',to_jsonb(coalesce((v_state->>'roots')::integer,0)+v_roots_yield),true);
      v_state := jsonb_set(v_state,'{stats,harvested}',to_jsonb(coalesce((v_state#>>'{stats,harvested}')::integer,0)+v_roots_yield),true);
      v_plot := jsonb_set(v_plot,'{stage}','"wild"');
      v_plot := jsonb_set(v_plot,'{growth}','0'::jsonb);
      v_plot := jsonb_set(v_plot,'{water}','0'::jsonb);
      v_plot := jsonb_set(v_plot,'{weeds}','0'::jsonb);
      v_gain := 20;
  end case;

  v_plots := jsonb_set(v_plots, array[p_plot_id::text], v_plot, false);
  v_state := jsonb_set(v_state,'{plots}',v_plots,true);
  v_xp := coalesce((v_state->>'xp')::bigint,0) + v_gain;
  v_total_xp := coalesce((v_state->>'totalXp')::bigint,0) + v_gain;
  v_state := jsonb_set(v_state,'{totalXp}',to_jsonb(v_total_xp),true);
  v_level := greatest(1,coalesce((v_state->>'level')::integer,1));
  v_new_xp := v_xp;
  v_new_level := v_level;
  loop
    v_needed := 100 + (v_new_level-1)*60;
    exit when v_new_xp < v_needed;
    v_new_xp := v_new_xp-v_needed;
    v_new_level := v_new_level+1;
  end loop;
  v_state := jsonb_set(v_state,'{xp}',to_jsonb(v_new_xp),true);
  v_state := jsonb_set(v_state,'{level}',to_jsonb(v_new_level),true);

  update public.player_game_states
  set state=v_state, revision=revision+1, updated_at=now()
  where user_id=p_user_id
  returning revision into v_revision;
  update public.player_profiles
  set xp=v_total_xp,
      level=v_new_level
  where user_id=p_user_id;

  v_result := jsonb_build_object(
    'state',v_state,'revision',v_revision,'xp_gain',v_gain,
    'level',v_new_level,'duplicate',false
  );
  insert into public.game_action_events(user_id,action_type,idempotency_key,payload,result)
  values(p_user_id,p_action_type,p_idempotency_key,
    jsonb_build_object('plot_id',p_plot_id,'expected_revision',p_expected_revision),v_result);
  return v_result;
end;
$$;

revoke all on function public.apply_garriverse_action(uuid,text,integer,text,bigint) from public, anon, authenticated;
grant execute on function public.apply_garriverse_action(uuid,text,integer,text,bigint) to service_role;
