alter table public.weekly_plans
  add column weekly_kcal_budget integer
  check (weekly_kcal_budget between 1 and 140000);

create or replace function private.create_week(p_start date, p_now timestamptz) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_tz text := 'Europe/Bucharest'; v_state text; v_reason text;
begin
  if (select count(*) from public.members) <> 2 then raise exception 'SETUP_INCOMPLETE'; end if;
  v_state := case when p_now < ((p_start::timestamp + interval '12 hours') at time zone v_tz) then 'draft' else 'unranked' end;
  v_reason := case when v_state = 'unranked' then 'setup_midweek' end;
  insert into public.weeks (week_start, starts_at, ends_at, approval_deadline, finalize_at, state, unranked_reason, theme_id)
  values (p_start, p_start::timestamp at time zone v_tz, (p_start + 7)::timestamp at time zone v_tz,
    (p_start::timestamp + interval '12 hours') at time zone v_tz, ((p_start + 7)::timestamp + interval '12 hours') at time zone v_tz,
    v_state, v_reason, private.theme_for(p_start)) returning id into v_id;
  insert into public.weekly_plans (week_id,user_id,training_target,training_description,nutrition_mode,nutrition_target_days,nutrition_description,calorie_min,calorie_max,walking_minutes_target,walking_target_days,recovery_target_days,recovery_description,weekly_kcal_budget)
  select v_id, m.user_id, coalesce(old.training_target,2), coalesce(old.training_description,'Complete my planned gym or home session'),
    coalesce(old.nutrition_mode,'habit'), coalesce(old.nutrition_target_days,7), coalesce(old.nutrition_description,'Eat the meals I planned'),
    old.calorie_min, old.calorie_max, coalesce(old.walking_minutes_target,15), coalesce(old.walking_target_days,5),
    coalesce(old.recovery_target_days,5), coalesce(old.recovery_description,'Complete my personal wind-down routine'), old.weekly_kcal_budget
  from public.members m left join lateral (
    select wp.* from public.weekly_plans wp join public.weeks w on w.id=wp.week_id
    where wp.user_id=m.user_id and w.week_start<p_start and w.locked_at is not null order by w.week_start desc limit 1
  ) old on true;
  return v_id;
end $$;

create or replace function public.save_week_plan(p_week_id uuid,p_expected_revision int,p_plan jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_week public.weeks; v_now timestamptz; v_allowed text[] := array['training_target','training_description','nutrition_mode','nutrition_target_days','nutrition_description','calorie_min','calorie_max','walking_minutes_target','walking_target_days','recovery_target_days','recovery_description','weekly_kcal_budget'];
begin
  v_uid := private.require_member(); perform 1 from public.duel_settings where id=1 for update; select * into v_week from public.weeks where id=p_week_id for update; v_now := clock_timestamp();
  if v_week.state<>'draft' or v_week.locked_at is not null then raise exception 'PLAN_LOCKED'; end if;
  if v_now>=v_week.approval_deadline then raise exception 'APPROVAL_CLOSED'; end if;
  if v_week.revision<>p_expected_revision then raise exception 'STALE_REVISION'; end if;
  if exists(select 1 from jsonb_object_keys(p_plan) k where k<>all(v_allowed)) or not (p_plan ?& v_allowed) then raise exception 'INVALID_INPUT'; end if;
  if jsonb_typeof(p_plan->'weekly_kcal_budget') not in ('number','null') then raise exception 'INVALID_INPUT'; end if;
  update public.weekly_plans set training_target=(p_plan->>'training_target')::int,training_description=btrim(p_plan->>'training_description'),
    nutrition_mode=p_plan->>'nutrition_mode',nutrition_target_days=(p_plan->>'nutrition_target_days')::int,nutrition_description=btrim(p_plan->>'nutrition_description'),
    calorie_min=(p_plan->>'calorie_min')::int,calorie_max=(p_plan->>'calorie_max')::int,walking_minutes_target=(p_plan->>'walking_minutes_target')::int,
    walking_target_days=(p_plan->>'walking_target_days')::int,recovery_target_days=(p_plan->>'recovery_target_days')::int,recovery_description=btrim(p_plan->>'recovery_description'),weekly_kcal_budget=(p_plan->>'weekly_kcal_budget')::int
  where week_id=p_week_id and user_id=v_uid;
  update public.weeks set revision=revision+1 where id=p_week_id returning revision into p_expected_revision; delete from public.week_approvals where week_id=p_week_id;
  insert into public.audit_events(week_id,actor_user_id,event_type,metadata) values(p_week_id,v_uid,'plan_changed',jsonb_build_object('revision',p_expected_revision,'fields',v_allowed));
  return jsonb_build_object('revision',p_expected_revision);
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then raise exception 'INVALID_INPUT';
end $$;
