create or replace function public.save_week_plan(p_week_id uuid,p_expected_revision int,p_plan jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid; v_week public.weeks; v_now timestamptz;
  v_allowed text[] := array['training_target','training_description','nutrition_mode','nutrition_target_days','nutrition_description','calorie_min','calorie_max','walking_minutes_target','walking_target_days','recovery_target_days','recovery_description','weekly_kcal_budget'];
  v_integer_fields text[] := array['training_target','nutrition_target_days','calorie_min','calorie_max','walking_minutes_target','walking_target_days','recovery_target_days','weekly_kcal_budget'];
  v_key text; v_value jsonb;
begin
  v_uid := private.require_member();
  if p_week_id is null or p_expected_revision is null or p_plan is null then raise exception 'INVALID_INPUT'; end if;
  if jsonb_typeof(p_plan) <> 'object' then raise exception 'INVALID_INPUT'; end if;
  if exists(select 1 from jsonb_object_keys(p_plan) k where k<>all(v_allowed)) or not (p_plan ?& v_allowed) then raise exception 'INVALID_INPUT'; end if;
  foreach v_key in array v_integer_fields loop
    v_value := p_plan -> v_key;
    if v_value = 'null'::jsonb and v_key = any(array['calorie_min','calorie_max','weekly_kcal_budget']) then continue; end if;
    if jsonb_typeof(v_value) <> 'number' or (p_plan->>v_key)::numeric <> trunc((p_plan->>v_key)::numeric) then raise exception 'INVALID_INPUT'; end if;
  end loop;
  foreach v_key in array array['training_description','nutrition_description','nutrition_mode','recovery_description'] loop
    if jsonb_typeof(p_plan->v_key) <> 'string' then raise exception 'INVALID_INPUT'; end if;
  end loop;
  perform 1 from public.duel_settings where id=1 for update;
  select * into v_week from public.weeks where id=p_week_id for update;
  v_now := clock_timestamp();
  if v_week.id is null then raise exception 'INVALID_INPUT'; end if;
  if v_week.state<>'draft' or v_week.locked_at is not null then raise exception 'PLAN_LOCKED'; end if;
  if v_now>=v_week.approval_deadline then raise exception 'APPROVAL_CLOSED'; end if;
  if v_week.revision<>p_expected_revision then raise exception 'STALE_REVISION'; end if;
  update public.weekly_plans set training_target=(p_plan->>'training_target')::int,training_description=btrim(p_plan->>'training_description'),
    nutrition_mode=p_plan->>'nutrition_mode',nutrition_target_days=(p_plan->>'nutrition_target_days')::int,nutrition_description=btrim(p_plan->>'nutrition_description'),
    calorie_min=(p_plan->>'calorie_min')::int,calorie_max=(p_plan->>'calorie_max')::int,walking_minutes_target=(p_plan->>'walking_minutes_target')::int,
    walking_target_days=(p_plan->>'walking_target_days')::int,recovery_target_days=(p_plan->>'recovery_target_days')::int,
    recovery_description=btrim(p_plan->>'recovery_description'),weekly_kcal_budget=(p_plan->>'weekly_kcal_budget')::int
  where week_id=p_week_id and user_id=v_uid;
  if not found then raise exception 'INVALID_INPUT'; end if;
  update public.weeks set revision=revision+1 where id=p_week_id returning revision into p_expected_revision;
  delete from public.week_approvals where week_id=p_week_id;
  insert into public.audit_events(week_id,actor_user_id,event_type,metadata)
    values(p_week_id,v_uid,'plan_changed',jsonb_build_object('revision',p_expected_revision,'fields',v_allowed));
  return jsonb_build_object('revision',p_expected_revision);
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_parameter_value then raise exception 'INVALID_INPUT';
end $$;

create or replace function public.save_daily_log(p_week_id uuid,p_date date,p_expected_version int,p_request_id uuid,p_values jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid:=private.require_member(); w public.weeks; v_now timestamptz; v_existing public.daily_logs; v_fingerprint text; v_allowed text[]:=array['training_done','nutrition_habit_done','actual_kcal','walking_minutes','recovery_done','private_note']; v_row public.daily_logs;
  v_bool_fields text[]:=array['training_done','nutrition_habit_done','recovery_done']; v_number_fields text[]:=array['actual_kcal','walking_minutes']; v_key text; v_value jsonb;
begin
  if p_week_id is null or p_date is null or p_expected_version is null or p_expected_version<0 or p_request_id is null or p_values is null then raise exception 'INVALID_INPUT'; end if;
  if jsonb_typeof(p_values) <> 'object' then raise exception 'INVALID_INPUT'; end if;
  if exists(select 1 from jsonb_object_keys(p_values) k where k<>all(v_allowed)) or not (p_values ?& v_allowed) then raise exception 'INVALID_INPUT'; end if;
  foreach v_key in array v_bool_fields loop if jsonb_typeof(p_values->v_key)<>'boolean' then raise exception 'INVALID_INPUT'; end if; end loop;
  foreach v_key in array v_number_fields loop
    v_value:=p_values->v_key;
    if v_value='null'::jsonb then continue; end if;
    if jsonb_typeof(v_value)<>'number' or (p_values->>v_key)::numeric<>trunc((p_values->>v_key)::numeric) then raise exception 'INVALID_INPUT'; end if;
  end loop;
  if p_values->'private_note'<>'null'::jsonb and jsonb_typeof(p_values->'private_note')<>'string' then raise exception 'INVALID_INPUT'; end if;
  perform 1 from public.duel_settings where id=1 for update;
  select * into w from public.weeks where id=p_week_id for update;
  v_now:=clock_timestamp();
  if w.id is null or p_date<w.week_start or p_date>=w.week_start+7 then raise exception 'INVALID_INPUT'; end if;
  if p_date>(v_now at time zone 'Europe/Bucharest')::date then raise exception 'FUTURE_DATE'; end if;
  v_fingerprint:=encode(extensions.digest(p_values::text,'sha256'),'hex');
  select * into v_existing from public.daily_logs where week_id=p_week_id and user_id=v_uid and log_date=p_date for update;
  if v_existing.week_id is not null and v_existing.last_request_id=p_request_id then
    if v_existing.request_fingerprint=v_fingerprint then return to_jsonb(v_existing); else raise exception 'REQUEST_REUSED'; end if;
  end if;
  if w.state='finalized' or v_now>=((p_date+1)::timestamp+interval '12 hours') at time zone 'Europe/Bucharest' then raise exception 'LOG_WINDOW_CLOSED'; end if;
  if (v_existing.week_id is null and p_expected_version<>0) or (v_existing.week_id is not null and v_existing.version<>p_expected_version) then raise exception 'STALE_VERSION'; end if;
  insert into public.daily_logs(week_id,user_id,log_date,training_done,nutrition_habit_done,actual_kcal,walking_minutes,recovery_done,private_note,version,last_request_id,request_fingerprint)
  values(p_week_id,v_uid,p_date,(p_values->>'training_done')::boolean,(p_values->>'nutrition_habit_done')::boolean,(p_values->>'actual_kcal')::int,(p_values->>'walking_minutes')::int,(p_values->>'recovery_done')::boolean,nullif(btrim(p_values->>'private_note'),''),1,p_request_id,v_fingerprint)
  on conflict(week_id,user_id,log_date) do update set training_done=excluded.training_done,nutrition_habit_done=excluded.nutrition_habit_done,actual_kcal=excluded.actual_kcal,walking_minutes=excluded.walking_minutes,recovery_done=excluded.recovery_done,private_note=excluded.private_note,version=public.daily_logs.version+1,last_request_id=excluded.last_request_id,request_fingerprint=excluded.request_fingerprint,updated_at=v_now returning * into v_row;
  insert into public.audit_events(week_id,actor_user_id,event_type,metadata) values(p_week_id,v_uid,'log_saved',jsonb_build_object('date',p_date,'fields',v_allowed));
  return to_jsonb(v_row);
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or invalid_parameter_value then raise exception 'INVALID_INPUT';
end $$;

create or replace function public.save_weight(p_date date,p_kg numeric,p_expected_version int) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=private.require_member(); v_row public.weight_entries; v_old public.weight_entries;
begin
  if p_kg is null or p_kg<>trunc(p_kg,2) then raise exception 'INVALID_INPUT'; end if;
  if p_date is null or p_expected_version is null or p_expected_version<0 then raise exception 'INVALID_INPUT'; end if;
  if p_date>(clock_timestamp() at time zone 'Europe/Bucharest')::date then raise exception 'FUTURE_DATE'; end if;
  select * into v_old from public.weight_entries where user_id=v_uid and measured_on=p_date for update;
  if (v_old.user_id is null and p_expected_version<>0) or (v_old.user_id is not null and v_old.version<>p_expected_version) then raise exception 'STALE_VERSION'; end if;
  insert into public.weight_entries(user_id,measured_on,kg) values(v_uid,p_date,p_kg)
  on conflict(user_id,measured_on) do update set kg=excluded.kg,version=public.weight_entries.version+1,updated_at=clock_timestamp() returning * into v_row;
  return to_jsonb(v_row);
exception when check_violation or numeric_value_out_of_range then raise exception 'INVALID_INPUT';
end $$;
