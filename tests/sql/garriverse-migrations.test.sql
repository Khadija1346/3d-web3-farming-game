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

select 'GARRIVERSE SQL migration integration tests passed' as result;
