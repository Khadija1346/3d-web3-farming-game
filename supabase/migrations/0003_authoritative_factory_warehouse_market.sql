-- Server-authoritative factory, warehouse and in-game market actions.
create or replace function public.apply_garriverse_economy_action(
  p_user_id uuid,
  p_action_type text,
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
  v_revision bigint;
  v_result jsonb;
  v_existing jsonb;
  v_factory jsonb;
  v_roots integer;
  v_carried integer;
  v_stored integer;
  v_naira integer;
  v_stems integer;
  v_stage integer;
  v_seconds numeric;
  v_started timestamptz;
  v_gain integer := 0;
  v_total_xp bigint;
  v_new_xp bigint;
  v_new_level integer;
  v_level integer;
  v_needed integer;
begin
  if p_user_id is null or p_action_type is null or p_action_type not in (
    'factory_start','factory_run_stage','factory_complete_stage',
    'warehouse_deposit','market_sell','market_buy_stems'
  ) then
    raise exception using errcode='22023', message='invalid_action';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 or length(p_idempotency_key) > 128 then
    raise exception using errcode='22023', message='invalid_idempotency_key';
  end if;

  select result into v_existing from public.game_action_events
  where user_id=p_user_id and idempotency_key=p_idempotency_key;
  if found then return v_existing || jsonb_build_object('duplicate',true); end if;

  select state,revision into v_state,v_revision
  from public.player_game_states where user_id=p_user_id for update;
  if not found then raise exception using errcode='P0002', message='player_state_missing'; end if;

  select result into v_existing from public.game_action_events
  where user_id=p_user_id and idempotency_key=p_idempotency_key;
  if found then return v_existing || jsonb_build_object('duplicate',true); end if;

  if p_expected_revision is not null and p_expected_revision<>v_revision then
    raise exception using errcode='40001', message='revision_conflict';
  end if;

  if coalesce(jsonb_typeof(v_state->'plots')<>'array',true)
     or coalesce(jsonb_array_length(v_state->'plots')<>12,true) then
    select jsonb_agg(jsonb_build_object('id',n,'stage','wild','growth',0,'water',0,'weeds',0) order by n)
      into v_plots from generate_series(0,11) as n;
    v_state:=jsonb_build_object(
      'plots',v_plots,'stems',12,'roots',0,'garriCarried',0,'garriStored',0,
      'naira',500,'waterCan',5,'tankerWater',100,'xp',0,'totalXp',0,'level',1,
      'lastSimulatedAt',now(),
      'stats',jsonb_build_object('harvested',0,'bagsMade',0,'plotsTilled',0)
    );
  end if;

  case p_action_type
    when 'factory_start' then
      if v_state->'factory' is not null and v_state->'factory'<>'null'::jsonb then
        raise exception using errcode='22023',message='factory_already_running';
      end if;
      v_roots:=coalesce((v_state->>'roots')::integer,0);
      if v_roots<5 then raise exception using errcode='22023',message='not_enough_roots'; end if;
      v_state:=jsonb_set(v_state,'{roots}',to_jsonb(v_roots-5),true);
      v_state:=jsonb_set(v_state,'{factory}',jsonb_build_object(
        'stageIndex',0,'running',false,'progress',0,'startedAt',null
      ),true);

    when 'factory_run_stage' then
      v_factory:=v_state->'factory';
      if v_factory is null or v_factory='null'::jsonb then
        raise exception using errcode='22023',message='factory_batch_missing';
      end if;
      if coalesce((v_factory->>'running')::boolean,false) then
        raise exception using errcode='22023',message='factory_stage_running';
      end if;
      v_factory:=jsonb_set(v_factory,'{running}','true'::jsonb,true);
      v_factory:=jsonb_set(v_factory,'{progress}','0'::jsonb,true);
      v_factory:=jsonb_set(v_factory,'{startedAt}',to_jsonb(clock_timestamp()),true);
      v_state:=jsonb_set(v_state,'{factory}',v_factory,true);

    when 'factory_complete_stage' then
      v_factory:=v_state->'factory';
      if v_factory is null or v_factory='null'::jsonb
         or not coalesce((v_factory->>'running')::boolean,false) then
        raise exception using errcode='22023',message='factory_stage_not_running';
      end if;
      v_stage:=coalesce((v_factory->>'stageIndex')::integer,-1);
      if v_stage<0 or v_stage>7 then
        raise exception using errcode='22023',message='invalid_factory_stage';
      end if;
      v_started:=nullif(v_factory->>'startedAt','')::timestamptz;
      if v_started is null then raise exception using errcode='22023',message='factory_stage_not_started'; end if;
      v_seconds:=case v_stage when 0 then 3 when 1 then 2.5 when 2 then 3 when 3 then 8
        when 4 then 4 when 5 then 3 when 6 then 5 when 7 then 2.5 end;
      if extract(epoch from (clock_timestamp()-v_started))<v_seconds then
        raise exception using errcode='22023',message='factory_stage_not_ready';
      end if;
      if v_stage=7 then
        v_state:=jsonb_set(v_state,'{factory}','null'::jsonb,true);
        v_carried:=coalesce((v_state->>'garriCarried')::integer,0);
        v_state:=jsonb_set(v_state,'{garriCarried}',to_jsonb(v_carried+2),true);
        v_state:=jsonb_set(v_state,'{stats,bagsMade}',to_jsonb(coalesce((v_state#>>'{stats,bagsMade}')::integer,0)+2),true);
        v_gain:=25;
      else
        v_factory:=jsonb_set(v_factory,'{stageIndex}',to_jsonb(v_stage+1),true);
        v_factory:=jsonb_set(v_factory,'{running}','false'::jsonb,true);
        v_factory:=jsonb_set(v_factory,'{progress}','0'::jsonb,true);
        v_factory:=jsonb_set(v_factory,'{startedAt}','null'::jsonb,true);
        v_state:=jsonb_set(v_state,'{factory}',v_factory,true);
        v_gain:=6;
      end if;

    when 'warehouse_deposit' then
      v_carried:=coalesce((v_state->>'garriCarried')::integer,0);
      if v_carried<=0 then raise exception using errcode='22023',message='no_garri_to_store'; end if;
      v_stored:=coalesce((v_state->>'garriStored')::integer,0);
      v_state:=jsonb_set(v_state,'{garriCarried}','0'::jsonb,true);
      v_state:=jsonb_set(v_state,'{garriStored}',to_jsonb(v_stored+v_carried),true);

    when 'market_sell' then
      v_stored:=coalesce((v_state->>'garriStored')::integer,0);
      if v_stored<=0 then raise exception using errcode='22023',message='no_garri_to_sell'; end if;
      v_naira:=coalesce((v_state->>'naira')::integer,500);
      v_state:=jsonb_set(v_state,'{garriStored}',to_jsonb(v_stored-1),true);
      v_state:=jsonb_set(v_state,'{naira}',to_jsonb(v_naira+1200),true);
      v_gain:=10;

    when 'market_buy_stems' then
      v_naira:=coalesce((v_state->>'naira')::integer,500);
      if v_naira<150 then raise exception using errcode='22023',message='insufficient_game_currency'; end if;
      v_stems:=coalesce((v_state->>'stems')::integer,12);
      v_state:=jsonb_set(v_state,'{naira}',to_jsonb(v_naira-150),true);
      v_state:=jsonb_set(v_state,'{stems}',to_jsonb(v_stems+4),true);
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

  v_result:=jsonb_build_object('state',v_state,'revision',v_revision,'xp_gain',v_gain,
    'level',v_new_level,'duplicate',false);
  insert into public.game_action_events(user_id,action_type,idempotency_key,payload,result)
  values(p_user_id,p_action_type,p_idempotency_key,
    jsonb_build_object('expected_revision',p_expected_revision),v_result);
  return v_result;
end;
$$;

revoke all on function public.apply_garriverse_economy_action(uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.apply_garriverse_economy_action(uuid,text,text,bigint) to service_role;
