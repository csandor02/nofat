create or replace function private.require_member() returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (select 1 from public.members where user_id = v_uid) then raise exception 'NOT_MEMBER'; end if;
  return v_uid;
end $$;

create or replace function private.theme_for(p_week date) returns text language sql immutable set search_path = '' as $$
  select (array['keep_your_word','ordinary_excellence','long_game','quiet_work'])[1 + mod(((p_week - date '2000-01-03') / 7), 4)]
$$;

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
  insert into public.weekly_plans (week_id,user_id,training_target,training_description,nutrition_mode,nutrition_target_days,nutrition_description,calorie_min,calorie_max,walking_minutes_target,walking_target_days,recovery_target_days,recovery_description)
  select v_id, m.user_id, coalesce(old.training_target,2), coalesce(old.training_description,'Complete my planned gym or home session'),
    coalesce(old.nutrition_mode,'habit'), coalesce(old.nutrition_target_days,7), coalesce(old.nutrition_description,'Eat the meals I planned'),
    old.calorie_min, old.calorie_max, coalesce(old.walking_minutes_target,15), coalesce(old.walking_target_days,5),
    coalesce(old.recovery_target_days,5), coalesce(old.recovery_description,'Complete my personal wind-down routine')
  from public.members m left join lateral (
    select wp.* from public.weekly_plans wp join public.weeks w on w.id=wp.week_id
    where wp.user_id=m.user_id and w.week_start<p_start and w.locked_at is not null order by w.week_start desc limit 1
  ) old on true;
  return v_id;
end $$;

create or replace function public.sync_duel() returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_now timestamptz; v_today date; v_monday date; v_current uuid; v_next uuid; v_tz text := 'Europe/Bucharest'; v_due record;
begin
  v_uid := private.require_member();
  perform 1 from public.duel_settings where id=1 for update; v_now := clock_timestamp();
  v_today := (v_now at time zone v_tz)::date; v_monday := date_trunc('week', v_today)::date;
  update public.weeks set state='unranked',unranked_reason='approval_missing'
    where state='draft' and approval_deadline<=v_now;
  for v_due in select id from public.weeks where state<>'finalized' and finalize_at<=v_now order by week_start loop
    perform private.finalize_locked(v_due.id,v_now);
  end loop;
  select id into v_current from public.weeks where week_start=v_monday;
  if v_current is null then v_current := private.create_week(v_monday,v_now); end if;
  if extract(isodow from v_today)=7 then
    select id into v_next from public.weeks where week_start=v_monday+7;
    if v_next is null then v_next := private.create_week(v_monday+7,v_now); end if;
  end if;
  return jsonb_build_object('server_now',v_now,'current_week_id',v_current,'next_week_id',v_next,
    'editable_dates',(select coalesce(jsonb_agg(jsonb_build_object('date',d,'week_id',w.id,'editable_until',((d+1)::timestamp+interval '12 hours') at time zone v_tz) order by d),'[]')
      from (values(v_today-1),(v_today)) x(d) join public.weeks w on x.d>=w.week_start and x.d<w.week_start+7
      where d<=v_today and v_now<((d+1)::timestamp+interval '12 hours') at time zone v_tz),
    'unseen_result_ids',(select coalesce(jsonb_agg(r.week_id order by r.finalized_at desc),'[]') from public.weekly_results r left join public.result_views rv on rv.week_id=r.week_id and rv.user_id=v_uid where rv.week_id is null));
end $$;

create or replace function public.save_week_plan(p_week_id uuid,p_expected_revision int,p_plan jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_week public.weeks; v_now timestamptz; v_allowed text[] := array['training_target','training_description','nutrition_mode','nutrition_target_days','nutrition_description','calorie_min','calorie_max','walking_minutes_target','walking_target_days','recovery_target_days','recovery_description'];
begin
  v_uid:=private.require_member(); perform 1 from public.duel_settings where id=1 for update; select * into v_week from public.weeks where id=p_week_id for update; v_now:=clock_timestamp();
  if v_week.state<>'draft' or v_week.locked_at is not null then raise exception 'PLAN_LOCKED'; end if;
  if v_now>=v_week.approval_deadline then raise exception 'APPROVAL_CLOSED'; end if;
  if v_week.revision<>p_expected_revision then raise exception 'STALE_REVISION'; end if;
  if exists(select 1 from jsonb_object_keys(p_plan) k where k<>all(v_allowed)) or not (p_plan ?& v_allowed) then raise exception 'INVALID_INPUT'; end if;
  update public.weekly_plans set training_target=(p_plan->>'training_target')::int,training_description=btrim(p_plan->>'training_description'),
    nutrition_mode=p_plan->>'nutrition_mode',nutrition_target_days=(p_plan->>'nutrition_target_days')::int,nutrition_description=btrim(p_plan->>'nutrition_description'),
    calorie_min=(p_plan->>'calorie_min')::int,calorie_max=(p_plan->>'calorie_max')::int,walking_minutes_target=(p_plan->>'walking_minutes_target')::int,
    walking_target_days=(p_plan->>'walking_target_days')::int,recovery_target_days=(p_plan->>'recovery_target_days')::int,recovery_description=btrim(p_plan->>'recovery_description')
  where week_id=p_week_id and user_id=v_uid;
  update public.weeks set revision=revision+1 where id=p_week_id returning revision into p_expected_revision; delete from public.week_approvals where week_id=p_week_id;
  insert into public.audit_events(week_id,actor_user_id,event_type,metadata) values(p_week_id,v_uid,'plan_changed',jsonb_build_object('revision',p_expected_revision,'fields',v_allowed));
  return jsonb_build_object('revision',p_expected_revision);
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then raise exception 'INVALID_INPUT';
end $$;

create or replace function public.set_week_reward(p_week_id uuid,p_expected_revision int,p_text text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=private.require_member(); v_week public.weeks; v_now timestamptz;
begin perform 1 from public.duel_settings where id=1 for update; select * into v_week from public.weeks where id=p_week_id for update; v_now:=clock_timestamp();
  if v_week.state<>'draft' or v_week.locked_at is not null then raise exception 'PLAN_LOCKED'; end if; if v_now>=v_week.approval_deadline then raise exception 'APPROVAL_CLOSED'; end if;
  if v_week.revision<>p_expected_revision then raise exception 'STALE_REVISION'; end if; if char_length(btrim(p_text)) not between 1 and 160 then raise exception 'INVALID_INPUT'; end if;
  update public.weeks set reward_text=btrim(p_text),revision=revision+1 where id=p_week_id returning revision into p_expected_revision; delete from public.week_approvals where week_id=p_week_id;
  insert into public.audit_events(week_id,actor_user_id,event_type,metadata) values(p_week_id,v_uid,'reward_changed',jsonb_build_object('revision',p_expected_revision)); return jsonb_build_object('revision',p_expected_revision);
end $$;

create or replace function public.approve_week(p_week_id uuid,p_revision int) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=private.require_member(); v_week public.weeks; v_now timestamptz; v_count int;
begin perform 1 from public.duel_settings where id=1 for update; select * into v_week from public.weeks where id=p_week_id for update; v_now:=clock_timestamp();
  if v_week.locked_at is not null then return jsonb_build_object('state',v_week.state,'locked_at',v_week.locked_at); end if;
  if v_week.state<>'draft' then raise exception 'PLAN_LOCKED'; end if; if v_now>=v_week.approval_deadline then raise exception 'APPROVAL_CLOSED'; end if; if v_week.revision<>p_revision then raise exception 'STALE_REVISION'; end if;
  if (select count(*) from public.weekly_plans where week_id=p_week_id)<>2 then raise exception 'SETUP_INCOMPLETE'; end if;
  insert into public.week_approvals values(p_week_id,v_uid,p_revision,v_now) on conflict do nothing;
  if found then insert into public.audit_events(week_id,actor_user_id,event_type,metadata) values(p_week_id,v_uid,'approved',jsonb_build_object('revision',p_revision)); end if;
  select count(*) into v_count from public.week_approvals where week_id=p_week_id and approved_revision=p_revision;
  if v_count=2 then update public.weeks set state='active',locked_at=v_now where id=p_week_id; insert into public.audit_events(week_id,event_type,metadata) values(p_week_id,'locked',jsonb_build_object('revision',p_revision)); end if;
  return jsonb_build_object('state',case when v_count=2 then 'active' else 'draft' end,'approvals',v_count,'locked_at',case when v_count=2 then v_now end);
end $$;

create or replace function private.live_player(p_week uuid,p_uid uuid) returns jsonb language sql stable security definer set search_path = '' as $$
with p as (select * from public.weekly_plans where week_id=p_week and user_id=p_uid),
d as (select gs::date date,l.training_done,(case when p.nutrition_mode='habit' then coalesce(l.nutrition_habit_done,false) else l.actual_kcal is not null and l.actual_kcal between p.calorie_min and p.calorie_max end) nutrition,
  coalesce(l.walking_minutes,0)>=p.walking_minutes_target walking,coalesce(l.recovery_done,false) recovery from p join public.weeks w on w.id=p.week_id cross join generate_series(w.week_start,w.week_start+6,interval '1 day') gs left join public.daily_logs l on l.week_id=p.week_id and l.user_id=p_uid and l.log_date=gs::date),
c as (select least(count(*) filter(where training_done),p.training_target)::int tr,least(count(*) filter(where nutrition),p.nutrition_target_days)::int nu,least(count(*) filter(where walking),p.walking_target_days)::int wa,least(count(*) filter(where recovery),p.recovery_target_days)::int re,p.* from d cross join p group by p.week_id,p.user_id,p.training_target,p.training_description,p.nutrition_mode,p.nutrition_target_days,p.nutrition_description,p.calorie_min,p.calorie_max,p.walking_minutes_target,p.walking_target_days,p.recovery_target_days,p.recovery_description)
select jsonb_build_object('user_id',m.user_id,'display_name',m.display_name,'score_bp',(4000*c.tr/c.training_target)+(3000*c.nu/c.nutrition_target_days)+(2000*c.wa/c.walking_target_days)+(1000*c.re/c.recovery_target_days),
 'categories',jsonb_build_object('training',jsonb_build_object('credited',c.tr,'target',c.training_target,'weight_bp',4000,'earned_bp',4000*c.tr/c.training_target,'description',c.training_description),'nutrition',jsonb_build_object('credited',c.nu,'target',c.nutrition_target_days,'weight_bp',3000,'earned_bp',3000*c.nu/c.nutrition_target_days,'description',c.nutrition_description),'walking',jsonb_build_object('credited',c.wa,'target',c.walking_target_days,'weight_bp',2000,'earned_bp',2000*c.wa/c.walking_target_days,'description',c.walking_minutes_target||' minute walk'),'recovery',jsonb_build_object('credited',c.re,'target',c.recovery_target_days,'weight_bp',1000,'earned_bp',1000*c.re/c.recovery_target_days,'description',c.recovery_description)),
 'daily',(select jsonb_agg(jsonb_build_object('date',date,'training',coalesce(training_done,false),'nutrition',nutrition,'walking',walking,'recovery',recovery) order by date) from d),'badges','[]'::jsonb)
from c join public.members m on m.user_id=c.user_id
$$;

create or replace function public.get_week_summary(p_week_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=private.require_member(); w public.weeks; v_now timestamptz:=clock_timestamp(); v_stage text; v_players jsonb;
begin select * into w from public.weeks where id=p_week_id; if not found then raise exception 'INVALID_INPUT'; end if;
 v_stage:=case when w.state='finalized' then 'finalized' when v_now<w.starts_at then 'scheduled' when w.state='draft' then 'planning' when v_now<w.ends_at then 'live' when v_now<w.finalize_at then 'corrections' else 'ready_to_finalize' end;
 select jsonb_agg(private.live_player(p_week_id,m.user_id) order by m.slot) into v_players from public.members m;
 return to_jsonb(w)||jsonb_build_object('week_id',w.id,'server_now',v_now,'stage',v_stage,'ranked',(w.state='active' and v_now>=w.starts_at) or exists(select 1 from public.weekly_results r where r.week_id=w.id and r.outcome in('win','tie')),
  'plans',(select jsonb_agg(to_jsonb(p)||jsonb_build_object('display_name',m.display_name) order by m.slot) from public.weekly_plans p join public.members m on m.user_id=p.user_id where p.week_id=w.id),
  'approvals',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.week_approvals a where a.week_id=w.id),'players',v_players,
  'result',(select r.snapshot from public.weekly_results r where r.week_id=w.id));
end $$;
