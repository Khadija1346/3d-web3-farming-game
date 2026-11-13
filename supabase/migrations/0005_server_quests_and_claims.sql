-- Server-derived daily/weekly/all-time quests and atomic reward claims.
create table if not exists public.player_quest_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id text not null,
  period_key text not null,
  reward jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, quest_id, period_key)
);
alter table public.player_quest_claims enable row level security;
revoke all on public.player_quest_claims from anon, authenticated;
grant select, insert on public.player_quest_claims to service_role;

create or replace function public.get_garriverse_quests(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day_start timestamptz := date_trunc('day', timezone('UTC', clock_timestamp())) at time zone 'UTC';
  v_week_start timestamptz := date_trunc('week', timezone('UTC', clock_timestamp())) at time zone 'UTC';
  v_day_key text;
  v_week_key text;
  v_revision bigint;
  v_plant integer;
  v_water integer;
  v_bags integer;
  v_till integer;
begin
  if p_user_id is null then raise exception using errcode='22023',message='invalid_user'; end if;
  v_day_key:=to_char(v_day_start at time zone 'UTC','YYYY-MM-DD');
  v_week_key:=to_char(v_week_start at time zone 'UTC','YYYY-MM-DD');
  select revision into v_revision from public.player_game_states where user_id=p_user_id;
  if not found then raise exception using errcode='P0002',message='player_state_missing'; end if;

  select count(*) into v_plant from public.game_action_events
  where user_id=p_user_id and action_type='plant' and created_at>=v_day_start;
  select count(*) into v_water from public.game_action_events
  where user_id=p_user_id and action_type in ('water','water_tanker') and created_at>=v_day_start;
  select count(*)*2 into v_bags from public.game_action_events
  where user_id=p_user_id and action_type='factory_complete_stage'
    and result->'state'->'factory'='null'::jsonb and created_at>=v_week_start;
  select count(*) into v_till from public.game_action_events
  where user_id=p_user_id and action_type='till';

  return jsonb_build_object(
    'revision',v_revision,
    'quests',jsonb_build_array(
      jsonb_build_object('id','d-plant','title','Morning Rows','cadence','daily','periodKey',v_day_key,'progress',least(v_plant,4),'target',4,'reward',jsonb_build_object('xp',60,'stems',2),'claimed',exists(select 1 from public.player_quest_claims where user_id=p_user_id and quest_id='d-plant' and period_key=v_day_key)),
      jsonb_build_object('id','d-water','title','Borehole Run','cadence','daily','periodKey',v_day_key,'progress',least(v_water,6),'target',6,'reward',jsonb_build_object('xp',40),'claimed',exists(select 1 from public.player_quest_claims where user_id=p_user_id and quest_id='d-water' and period_key=v_day_key)),
      jsonb_build_object('id','w-garri','title','Market Day','cadence','weekly','periodKey',v_week_key,'progress',least(v_bags,10),'target',10,'reward',jsonb_build_object('xp',400),'claimed',exists(select 1 from public.player_quest_claims where user_id=p_user_id and quest_id='w-garri' and period_key=v_week_key)),
      jsonb_build_object('id','s-till','title','Prepared Farmer','cadence','special','periodKey','all-time','progress',least(v_till,20),'target',20,'reward',jsonb_build_object('xp',100),'claimed',exists(select 1 from public.player_quest_claims where user_id=p_user_id and quest_id='s-till' and period_key='all-time'))
    )
  );
end;
$$;

create or replace function public.claim_garriverse_quest(
  p_user_id uuid,
  p_quest_id text,
  p_period_key text,
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
  v_revision bigint;
  v_existing jsonb;
  v_day_start timestamptz := date_trunc('day', timezone('UTC', clock_timestamp())) at time zone 'UTC';
  v_week_start timestamptz := date_trunc('week', timezone('UTC', clock_timestamp())) at time zone 'UTC';
  v_day_key text;
  v_week_key text;
  v_progress integer := 0;
  v_target integer;
  v_xp integer := 0;
  v_stems integer := 0;
  v_new_xp bigint;
  v_total_xp bigint;
  v_level integer;
  v_new_level integer;
  v_needed integer;
  v_result jsonb;
begin
  if p_user_id is null or p_quest_id is null or p_period_key is null then
    raise exception using errcode='22023',message='invalid_quest_claim';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key)<8 or length(p_idempotency_key)>128 then
    raise exception using errcode='22023',message='invalid_idempotency_key';
  end if;
  v_day_key:=to_char(v_day_start at time zone 'UTC','YYYY-MM-DD');
  v_week_key:=to_char(v_week_start at time zone 'UTC','YYYY-MM-DD');

  select result into v_existing from public.game_action_events
  where user_id=p_user_id and idempotency_key=p_idempotency_key;
  if found then return v_existing || jsonb_build_object('duplicate',true); end if;

  select state,revision into v_state,v_revision from public.player_game_states
  where user_id=p_user_id for update;
  if not found then raise exception using errcode='P0002',message='player_state_missing'; end if;
  select result into v_existing from public.game_action_events
  where user_id=p_user_id and idempotency_key=p_idempotency_key;
  if found then return v_existing || jsonb_build_object('duplicate',true); end if;
  if p_expected_revision is not null and p_expected_revision<>v_revision then
    raise exception using errcode='40001',message='revision_conflict';
  end if;

  case p_quest_id
    when 'd-plant' then
      if p_period_key<>v_day_key then raise exception using errcode='22023',message='quest_period_expired'; end if;
      select count(*) into v_progress from public.game_action_events where user_id=p_user_id and action_type='plant' and created_at>=v_day_start;
      v_target:=4; v_xp:=60; v_stems:=2;
    when 'd-water' then
      if p_period_key<>v_day_key then raise exception using errcode='22023',message='quest_period_expired'; end if;
      select count(*) into v_progress from public.game_action_events where user_id=p_user_id and action_type in ('water','water_tanker') and created_at>=v_day_start;
      v_target:=6; v_xp:=40;
    when 'w-garri' then
      if p_period_key<>v_week_key then raise exception using errcode='22023',message='quest_period_expired'; end if;
      select count(*)*2 into v_progress from public.game_action_events
      where user_id=p_user_id and action_type='factory_complete_stage'
        and result->'state'->'factory'='null'::jsonb and created_at>=v_week_start;
      v_target:=10; v_xp:=400;
    when 's-till' then
      if p_period_key<>'all-time' then raise exception using errcode='22023',message='quest_period_expired'; end if;
      select count(*) into v_progress from public.game_action_events where user_id=p_user_id and action_type='till';
      v_target:=20; v_xp:=100;
    else
      raise exception using errcode='22023',message='unknown_quest';
  end case;

  if v_progress<v_target then raise exception using errcode='22023',message='quest_not_complete'; end if;
  if exists(select 1 from public.player_quest_claims where user_id=p_user_id and quest_id=p_quest_id and period_key=p_period_key) then
    raise exception using errcode='23505',message='quest_already_claimed';
  end if;

  v_new_xp:=coalesce((v_state->>'xp')::bigint,0)+v_xp;
  v_total_xp:=coalesce((v_state->>'totalXp')::bigint,0)+v_xp;
  v_level:=greatest(1,coalesce((v_state->>'level')::integer,1));
  v_new_level:=v_level;
  loop
    v_needed:=100+(v_new_level-1)*60;
    exit when v_new_xp<v_needed;
    v_new_xp:=v_new_xp-v_needed;
    v_new_level:=v_new_level+1;
  end loop;
  v_state:=jsonb_set(v_state,'{xp}',to_jsonb(v_new_xp),true);
  v_state:=jsonb_set(v_state,'{totalXp}',to_jsonb(v_total_xp),true);
  v_state:=jsonb_set(v_state,'{level}',to_jsonb(v_new_level),true);
  if v_stems>0 then
    v_state:=jsonb_set(v_state,'{stems}',to_jsonb(coalesce((v_state->>'stems')::integer,0)+v_stems),true);
  end if;

  update public.player_game_states set state=v_state,revision=revision+1,updated_at=now()
  where user_id=p_user_id returning revision into v_revision;
  update public.player_profiles set xp=v_total_xp,level=v_new_level where user_id=p_user_id;
  insert into public.player_quest_claims(user_id,quest_id,period_key,reward)
  values(p_user_id,p_quest_id,p_period_key,jsonb_build_object('xp',v_xp,'stems',v_stems));
  v_result:=jsonb_build_object('state',v_state,'revision',v_revision,'reward',jsonb_build_object('xp',v_xp,'stems',v_stems),'duplicate',false);
  insert into public.game_action_events(user_id,action_type,idempotency_key,payload,result)
  values(p_user_id,'quest_claim',p_idempotency_key,jsonb_build_object('quest_id',p_quest_id,'period_key',p_period_key),v_result);
  return v_result;
end;
$$;

revoke all on function public.get_garriverse_quests(uuid) from public,anon,authenticated;
grant execute on function public.get_garriverse_quests(uuid) to service_role;
revoke all on function public.claim_garriverse_quest(uuid,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.claim_garriverse_quest(uuid,text,text,text,bigint) to service_role;
