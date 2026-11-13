-- Integration smoke tests for migrations 0001 and 0002.
\set ON_ERROR_STOP on

insert into auth.users (id, raw_user_meta_data)
values ('11111111-1111-4111-8111-111111111111', '{"display_name":"CI Farmer"}')
on conflict (id) do nothing;

do $$
declare
  v_result jsonb;
  v_state jsonb;
  v_revision bigint;
  v_xp bigint;
begin
  if not exists (
    select 1 from public.player_profiles
    where user_id = '11111111-1111-4111-8111-111111111111'
      and display_name = 'CI Farmer'
  ) then raise exception 'auth user trigger did not create profile'; end if;

  if not exists (
    select 1 from public.player_game_states
    where user_id = '11111111-1111-4111-8111-111111111111'
  ) then raise exception 'auth user trigger did not create game state'; end if;

  if has_function_privilege('anon', 'public.apply_garriverse_action(uuid,text,integer,text,bigint)', 'EXECUTE') then
    raise exception 'anon must not execute authoritative farming RPC';
  end if;
  if not has_function_privilege('service_role', 'public.apply_garriverse_action(uuid,text,integer,text,bigint)', 'EXECUTE') then
    raise exception 'service_role must execute authoritative farming RPC';
  end if;

  v_result := public.apply_garriverse_action(
    '11111111-1111-4111-8111-111111111111', 'till', 0, 'ci-till-000001', 0
  );
  if (v_result->>'revision')::bigint <> 1 then raise exception 'till revision mismatch'; end if;
  if v_result#>>'{state,plots,0,stage}' <> 'tilled' then raise exception 'till state mismatch'; end if;

  v_result := public.apply_garriverse_action(
    '11111111-1111-4111-8111-111111111111', 'plant', 0, 'ci-plant-00001', 1
  );
  if (v_result->>'revision')::bigint <> 2 then raise exception 'plant revision mismatch'; end if;
  if v_result#>>'{state,plots,0,stage}' <> 'planted' then raise exception 'plant state mismatch'; end if;

  v_result := public.apply_garriverse_action(
    '11111111-1111-4111-8111-111111111111', 'water', 0, 'ci-water-00001', 2
  );
  if (v_result->>'revision')::bigint <> 3 then raise exception 'water revision mismatch'; end if;
  if (v_result#>>'{state,waterCan}')::integer <> 4 then raise exception 'watering can was not consumed'; end if;

  v_result := public.apply_garriverse_action(
    '11111111-1111-4111-8111-111111111111', 'water', 0, 'ci-water-00001', 2
  );
  if coalesce((v_result->>'duplicate')::boolean, false) is not true then raise exception 'idempotent retry not marked duplicate'; end if;
  if (v_result->>'revision')::bigint <> 3 then raise exception 'duplicate retry changed revision'; end if;

  select state, revision into v_state, v_revision
  from public.player_game_states
  where user_id = '11111111-1111-4111-8111-111111111111';
  if v_revision <> 3 then raise exception 'persisted revision mismatch'; end if;
  if (v_state->>'waterCan')::integer <> 4 then raise exception 'persisted state mismatch'; end if;

  select xp into v_xp from public.player_profiles
  where user_id = '11111111-1111-4111-8111-111111111111';
  if v_xp <> 13 then raise exception 'profile XP sync mismatch: %', v_xp; end if;

  begin
    perform public.apply_garriverse_action(
      '11111111-1111-4111-8111-111111111111', 'till', 1, 'ci-stale-00001', 0
    );
    raise exception 'stale revision should have failed';
  exception when sqlstate '40001' then
    null;
  end;
end
$$;

do $$
declare
  v_result jsonb;
  v_xp bigint;
begin
  -- Prepare an owned batch for server-side factory lifecycle tests.
  update public.player_game_states
  set state=jsonb_set(state,'{roots}','5'::jsonb,true)
  where user_id='11111111-1111-4111-8111-111111111111';

  v_result:=public.apply_garriverse_economy_action(
    '11111111-1111-4111-8111-111111111111','factory_start','ci-factory-start-01',3
  );
  if (v_result->>'revision')::bigint<>4 then raise exception 'factory start revision mismatch'; end if;
  if (v_result#>>'{state,roots}')::integer<>0 then raise exception 'factory did not consume roots'; end if;

  v_result:=public.apply_garriverse_economy_action(
    '11111111-1111-4111-8111-111111111111','factory_run_stage','ci-factory-run-001',4
  );
  if (v_result->>'revision')::bigint<>5 then raise exception 'factory run revision mismatch'; end if;
  if coalesce((v_result#>>'{state,factory,running}')::boolean,false) is not true then
    raise exception 'factory stage did not start';
  end if;
  begin
    perform public.apply_garriverse_economy_action(
      '11111111-1111-4111-8111-111111111111','factory_complete_stage','ci-factory-early-01',5
    );
    raise exception 'factory stage must not complete early';
  exception when sqlstate '22023' then
    if SQLERRM<>'factory_stage_not_ready' then raise; end if;
  end;
  perform pg_sleep(3.2);
  v_result:=public.apply_garriverse_economy_action(
    '11111111-1111-4111-8111-111111111111','factory_complete_stage','ci-factory-done-01',5
  );
  if (v_result->>'revision')::bigint<>6 then raise exception 'factory completion revision mismatch'; end if;
  if (v_result#>>'{state,factory,stageIndex}')::integer<>1 then raise exception 'factory stage did not advance'; end if;
  if coalesce((v_result#>>'{state,factory,running}')::boolean,true) is not false then
    raise exception 'next factory stage should await player start';
  end if;

  update public.player_game_states
  set state=jsonb_set(state,'{garriCarried}','2'::jsonb,true)
  where user_id='11111111-1111-4111-8111-111111111111';

  v_result:=public.apply_garriverse_economy_action(
    '11111111-1111-4111-8111-111111111111','warehouse_deposit','ci-warehouse-01',6
  );
  if (v_result#>>'{state,garriCarried}')::integer<>0
     or (v_result#>>'{state,garriStored}')::integer<>2 then
    raise exception 'warehouse deposit did not transfer carried bags';
  end if;

  v_result:=public.apply_garriverse_economy_action(
    '11111111-1111-4111-8111-111111111111','market_sell','ci-market-sell-01',7
  );
  if (v_result#>>'{state,garriStored}')::integer<>1
     or (v_result#>>'{state,naira}')::integer<>1700 then
    raise exception 'market sale did not update in-game inventory and balance';
  end if;

  v_result:=public.apply_garriverse_economy_action(
    '11111111-1111-4111-8111-111111111111','market_buy_stems','ci-market-buy-01',8
  );
  if (v_result#>>'{state,stems}')::integer<>15
     or (v_result#>>'{state,naira}')::integer<>1550 then
    raise exception 'market stem purchase did not update inventory and balance';
  end if;

  v_result:=public.apply_garriverse_economy_action(
    '11111111-1111-4111-8111-111111111111','market_buy_stems','ci-market-buy-01',8
  );
  if coalesce((v_result->>'duplicate')::boolean,false) is not true
     or (v_result->>'revision')::bigint<>9 then
    raise exception 'economy idempotency retry changed result';
  end if;

  select xp into v_xp from public.player_profiles
  where user_id='11111111-1111-4111-8111-111111111111';
  if v_xp<>29 then raise exception 'economy XP sync mismatch: %',v_xp; end if;


  -- Tanker watering and river-pump refills are server-authoritative too.
  update public.player_game_states
  set state=jsonb_set(
    jsonb_set(state,'{tankerWater}','80'::jsonb,true),
    '{plots,0,water}','0.2'::jsonb,true
  )
  where user_id='11111111-1111-4111-8111-111111111111';

  v_result:=public.apply_garriverse_utility_action(
    '11111111-1111-4111-8111-111111111111','water_tanker',0,'ci-tanker-water-01',9
  );
  if (v_result#>>'{state,tankerWater}')::integer<>70
     or (v_result#>>'{state,plots,0,water}')::numeric<>1 then
    raise exception 'tanker did not water the crop and consume ten units';
  end if;
  if (v_result->>'revision')::bigint<>10 then raise exception 'tanker water revision mismatch'; end if;

  v_result:=public.apply_garriverse_utility_action(
    '11111111-1111-4111-8111-111111111111','refill_tanker',null,'ci-tanker-refill-01',10
  );
  if (v_result#>>'{state,tankerWater}')::integer<>100 then raise exception 'tanker did not refill'; end if;
  if (v_result->>'revision')::bigint<>11 then raise exception 'tanker refill revision mismatch'; end if;

  v_result:=public.apply_garriverse_utility_action(
    '11111111-1111-4111-8111-111111111111','refill_tanker',null,'ci-tanker-refill-01',10
  );
  if coalesce((v_result->>'duplicate')::boolean,false) is not true
     or (v_result->>'revision')::bigint<>11 then
    raise exception 'tanker refill retry was not idempotent';
  end if;

  select xp into v_xp from public.player_profiles
  where user_id='11111111-1111-4111-8111-111111111111';
  if v_xp<>32 then raise exception 'tanker XP sync mismatch: %',v_xp; end if;

end
$$;

select 'GARRIVERSE SQL migration integration tests passed' as result;
