do $$
declare v_constraint record;
begin
  for v_constraint in
    select conname from pg_constraint
    where conrelid='public.weeks'::regclass and contype='c'
      and pg_get_constraintdef(oid) ilike '%state%' and pg_get_constraintdef(oid) ilike '%locked_at%'
  loop
    execute format('alter table public.weeks drop constraint %I',v_constraint.conname);
  end loop;
end $$;

alter table public.weeks add constraint weeks_active_reason_valid
  check (state <> 'active' or unranked_reason is null);

create or replace function public.save_week_plan(p_week_id uuid,p_expected_revision int,p_plan jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid; v_week public.weeks; v_now timestamptz;
  v_allowed text[] := array['training_target','training_description','nutrition_mode','nutrition_target_days','nutrition_description','calorie_min','calorie_max','walking_minutes_target','walking_target_days','recovery_target_days','recovery_description','weekly_kcal_budget'];
  v_integer_fields text[] := array['training_target','nutrition_target_days','calorie_min','calorie_max','walking_minutes_target','walking_target_days','recovery_target_days','weekly_kcal_budget'];
  v_key text; v_value jsonb;
begin
  v_uid := private.require_member();
  if p_week_id is null or p_expected_revision is null or p_plan is null or jsonb_typeof(p_plan)<>'object' then raise exception 'INVALID_INPUT'; end if;
  if exists(select 1 from jsonb_object_keys(p_plan) k where k<>all(v_allowed)) or not (p_plan ?& v_allowed) then raise exception 'INVALID_INPUT'; end if;
  foreach v_key in array v_integer_fields loop
    v_value:=p_plan->v_key;
    if v_value='null'::jsonb and v_key=any(array['calorie_min','calorie_max','weekly_kcal_budget']) then continue; end if;
    if jsonb_typeof(v_value)<>'number' or (p_plan->>v_key)::numeric<>trunc((p_plan->>v_key)::numeric) then raise exception 'INVALID_INPUT'; end if;
  end loop;
  foreach v_key in array array['training_description','nutrition_description','nutrition_mode','recovery_description'] loop
    if jsonb_typeof(p_plan->v_key)<>'string' then raise exception 'INVALID_INPUT'; end if;
  end loop;
  perform 1 from public.duel_settings where id=1 for update;
  select * into v_week from public.weeks where id=p_week_id for update;
  v_now:=clock_timestamp();
  if v_week.id is null then raise exception 'INVALID_INPUT'; end if;
  if v_week.state='draft' then
    if v_week.locked_at is not null then raise exception 'PLAN_LOCKED'; end if;
    if v_now>=v_week.approval_deadline then raise exception 'APPROVAL_CLOSED'; end if;
  elsif v_week.state='active' then
    if v_now>=v_week.ends_at then raise exception 'PLAN_LOCKED'; end if;
  else raise exception 'PLAN_LOCKED'; end if;
  if v_week.revision<>p_expected_revision then raise exception 'STALE_REVISION'; end if;
  update public.weekly_plans set training_target=(p_plan->>'training_target')::int,training_description=btrim(p_plan->>'training_description'),
    nutrition_mode=p_plan->>'nutrition_mode',nutrition_target_days=(p_plan->>'nutrition_target_days')::int,nutrition_description=btrim(p_plan->>'nutrition_description'),
    calorie_min=(p_plan->>'calorie_min')::int,calorie_max=(p_plan->>'calorie_max')::int,walking_minutes_target=(p_plan->>'walking_minutes_target')::int,
    walking_target_days=(p_plan->>'walking_target_days')::int,recovery_target_days=(p_plan->>'recovery_target_days')::int,
    recovery_description=btrim(p_plan->>'recovery_description'),weekly_kcal_budget=(p_plan->>'weekly_kcal_budget')::int
  where week_id=p_week_id and user_id=v_uid;
  if not found then raise exception 'INVALID_INPUT'; end if;
  update public.weeks set revision=revision+1,locked_at=case when state='active' then null else locked_at end where id=p_week_id returning revision into p_expected_revision;
  delete from public.week_approvals where week_id=p_week_id;
  insert into public.audit_events(week_id,actor_user_id,event_type,metadata) values(p_week_id,v_uid,'plan_changed',jsonb_build_object('revision',p_expected_revision,'fields',v_allowed));
  return jsonb_build_object('revision',p_expected_revision,'state',v_week.state,'needs_reapproval',true);
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_parameter_value then raise exception 'INVALID_INPUT';
end $$;

create or replace function public.approve_week(p_week_id uuid,p_revision int) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=private.require_member(); v_week public.weeks; v_now timestamptz; v_count int;
begin
  if p_week_id is null or p_revision is null then raise exception 'INVALID_INPUT'; end if;
  perform 1 from public.duel_settings where id=1 for update;
  select * into v_week from public.weeks where id=p_week_id for update;
  v_now:=clock_timestamp();
  if v_week.id is null then raise exception 'INVALID_INPUT'; end if;
  if v_week.locked_at is not null then return jsonb_build_object('state',v_week.state,'locked_at',v_week.locked_at); end if;
  if v_week.state='draft' then
    if v_now>=v_week.approval_deadline then raise exception 'APPROVAL_CLOSED'; end if;
  elsif v_week.state='active' then
    if v_now>=v_week.ends_at then raise exception 'APPROVAL_CLOSED'; end if;
  else raise exception 'PLAN_LOCKED'; end if;
  if v_week.revision<>p_revision then raise exception 'STALE_REVISION'; end if;
  if (select count(*) from public.weekly_plans where week_id=p_week_id)<>2 then raise exception 'SETUP_INCOMPLETE'; end if;
  insert into public.week_approvals values(p_week_id,v_uid,p_revision,v_now) on conflict do nothing;
  if found then insert into public.audit_events(week_id,actor_user_id,event_type,metadata) values(p_week_id,v_uid,'approved',jsonb_build_object('revision',p_revision)); end if;
  select count(*) into v_count from public.week_approvals where week_id=p_week_id and approved_revision=p_revision;
  if v_count=2 then
    update public.weeks set state='active',locked_at=v_now where id=p_week_id;
    insert into public.audit_events(week_id,event_type,metadata) values(p_week_id,'locked',jsonb_build_object('revision',p_revision));
  end if;
  return jsonb_build_object('state',case when v_count=2 then 'active' else v_week.state end,'approvals',v_count,'locked_at',case when v_count=2 then v_now end,'needs_reapproval',v_count<2);
end $$;

create or replace function public.get_week_summary(p_week_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=private.require_member(); w public.weeks; v_now timestamptz:=clock_timestamp(); v_stage text; v_players jsonb;
begin
  select * into w from public.weeks where id=p_week_id;
  if not found then raise exception 'INVALID_INPUT'; end if;
  v_stage:=case when w.state='finalized' then 'finalized' when v_now<w.starts_at then 'scheduled' when w.state='draft' then 'planning' when v_now<w.ends_at then 'live' when v_now<w.finalize_at then 'corrections' else 'ready_to_finalize' end;
  select jsonb_agg(private.live_player(p_week_id,m.user_id) order by m.slot) into v_players from public.members m;
  return to_jsonb(w)||jsonb_build_object('week_id',w.id,'server_now',v_now,'stage',v_stage,'ranked',(w.state='active' and w.locked_at is not null and v_now>=w.starts_at) or exists(select 1 from public.weekly_results r where r.week_id=w.id and r.outcome in('win','tie')),
    'plans',(select jsonb_agg(to_jsonb(p)||jsonb_build_object('display_name',m.display_name) order by m.slot) from public.weekly_plans p join public.members m on m.user_id=p.user_id where p.week_id=w.id),
    'approvals',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.week_approvals a where a.week_id=w.id),'players',v_players,
    'result',(select r.snapshot from public.weekly_results r where r.week_id=w.id));
end $$;

create or replace function public.sync_duel() returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_now timestamptz; v_today date; v_monday date; v_current uuid; v_next uuid; v_tz text:='Europe/Bucharest'; v_due record;
begin
  v_uid:=private.require_member(); perform 1 from public.duel_settings where id=1 for update;
  v_now:=clock_timestamp(); v_today:=(v_now at time zone v_tz)::date; v_monday:=date_trunc('week',v_today)::date;
  update public.weeks set state='unranked',unranked_reason='approval_missing' where state='draft' and approval_deadline<=v_now;
  update public.weeks set state='unranked',unranked_reason='approval_missing' where state='active' and locked_at is null and ends_at<=v_now;
  for v_due in select id from public.weeks where state<>'finalized' and finalize_at<=v_now order by week_start loop perform private.finalize_locked(v_due.id,v_now); end loop;
  select id into v_current from public.weeks where week_start=v_monday;
  if v_current is null then v_current:=private.create_week(v_monday,v_now); end if;
  if extract(isodow from v_today)=7 then select id into v_next from public.weeks where week_start=v_monday+7; if v_next is null then v_next:=private.create_week(v_monday+7,v_now); end if; end if;
  return jsonb_build_object('server_now',v_now,'current_week_id',v_current,'next_week_id',v_next,
    'editable_dates',(select coalesce(jsonb_agg(jsonb_build_object('date',d,'week_id',w.id,'editable_until',((d+1)::timestamp+interval '12 hours') at time zone v_tz) order by d),'[]') from (values(v_today-1),(v_today)) x(d) join public.weeks w on x.d>=w.week_start and x.d<w.week_start+7 where d<=v_today and v_now<((d+1)::timestamp+interval '12 hours') at time zone v_tz),
    'unseen_result_ids',(select coalesce(jsonb_agg(r.week_id order by r.finalized_at desc),'[]') from public.weekly_results r left join public.result_views rv on rv.week_id=r.week_id and rv.user_id=v_uid where rv.week_id is null));
end $$;

create or replace function public.finalize_week(p_week_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=private.require_member(); v_now timestamptz; w record; v_row public.weekly_results; v_target_start date;
begin
  if p_week_id is null then raise exception 'INVALID_INPUT'; end if;
  perform 1 from public.duel_settings where id=1 for update; v_now:=clock_timestamp();
  select week_start into v_target_start from public.weeks where id=p_week_id;
  if v_target_start is null then raise exception 'INVALID_INPUT'; end if;
  update public.weeks set state='unranked',unranked_reason='approval_missing' where week_start<=v_target_start and state='active' and locked_at is null and ends_at<=v_now;
  for w in select id from public.weeks where finalize_at<=v_now and state<>'finalized' and week_start<=v_target_start order by week_start loop v_row:=private.finalize_locked(w.id,v_now); end loop;
  select * into v_row from public.weekly_results where week_id=p_week_id;
  if not found then v_row:=private.finalize_locked(p_week_id,v_now); end if;
  return to_jsonb(v_row);
end $$;
