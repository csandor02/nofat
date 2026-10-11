create or replace function public.save_daily_log(p_week_id uuid,p_date date,p_expected_version int,p_request_id uuid,p_values jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=private.require_member(); w public.weeks; v_now timestamptz; v_existing public.daily_logs; v_fingerprint text; v_allowed text[]:=array['training_done','nutrition_habit_done','actual_kcal','walking_minutes','recovery_done','private_note']; v_row public.daily_logs;
begin
 perform 1 from public.duel_settings where id=1 for update; select * into w from public.weeks where id=p_week_id for update; v_now:=clock_timestamp();
 if w.id is null or p_date<w.week_start or p_date>=w.week_start+7 then raise exception 'INVALID_INPUT'; end if;
 if p_date>(v_now at time zone 'Europe/Bucharest')::date then raise exception 'FUTURE_DATE'; end if;
 if exists(select 1 from jsonb_object_keys(p_values) k where k<>all(v_allowed)) or not (p_values ?& v_allowed) then raise exception 'INVALID_INPUT'; end if;
 v_fingerprint:=encode(extensions.digest(p_values::text,'sha256'),'hex');
 select * into v_existing from public.daily_logs where week_id=p_week_id and user_id=v_uid and log_date=p_date for update;
 if v_existing.last_request_id=p_request_id then if v_existing.request_fingerprint=v_fingerprint then return to_jsonb(v_existing); else raise exception 'REQUEST_REUSED'; end if; end if;
 if w.state='finalized' or v_now>=((p_date+1)::timestamp+interval '12 hours') at time zone 'Europe/Bucharest' then raise exception 'LOG_WINDOW_CLOSED'; end if;
 if (v_existing.week_id is null and p_expected_version<>0) or (v_existing.week_id is not null and v_existing.version<>p_expected_version) then raise exception 'STALE_VERSION'; end if;
 insert into public.daily_logs(week_id,user_id,log_date,training_done,nutrition_habit_done,actual_kcal,walking_minutes,recovery_done,private_note,version,last_request_id,request_fingerprint)
 values(p_week_id,v_uid,p_date,(p_values->>'training_done')::boolean,(p_values->>'nutrition_habit_done')::boolean,(p_values->>'actual_kcal')::int,(p_values->>'walking_minutes')::int,(p_values->>'recovery_done')::boolean,nullif(btrim(p_values->>'private_note'),''),1,p_request_id,v_fingerprint)
 on conflict(week_id,user_id,log_date) do update set training_done=excluded.training_done,nutrition_habit_done=excluded.nutrition_habit_done,actual_kcal=excluded.actual_kcal,walking_minutes=excluded.walking_minutes,recovery_done=excluded.recovery_done,private_note=excluded.private_note,version=public.daily_logs.version+1,last_request_id=excluded.last_request_id,request_fingerprint=excluded.request_fingerprint,updated_at=v_now returning * into v_row;
 insert into public.audit_events(week_id,actor_user_id,event_type,metadata) values(p_week_id,v_uid,'log_saved',jsonb_build_object('date',p_date,'fields',v_allowed)); return to_jsonb(v_row);
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then raise exception 'INVALID_INPUT';
end $$;

create or replace function public.pause_week(p_week_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=private.require_member(); w public.weeks; v_now timestamptz;
begin perform 1 from public.duel_settings where id=1 for update; select * into w from public.weeks where id=p_week_id for update; v_now:=clock_timestamp();
 if w.state<>'active' or v_now<w.starts_at or v_now>=w.ends_at then raise exception 'INVALID_INPUT'; end if;
 update public.weeks set state='unranked',unranked_reason='recovery_pause' where id=p_week_id; insert into public.audit_events(week_id,actor_user_id,event_type,metadata) values(p_week_id,v_uid,'unranked','{"reason":"recovery_pause"}'); return jsonb_build_object('state','unranked','reason','recovery_pause');
end $$;

create or replace function public.save_weight(p_date date,p_kg numeric,p_expected_version int) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=private.require_member(); v_row public.weight_entries; v_old public.weight_entries;
begin if p_date>(clock_timestamp() at time zone 'Europe/Bucharest')::date then raise exception 'FUTURE_DATE'; end if; select * into v_old from public.weight_entries where user_id=v_uid and measured_on=p_date for update;
 if (v_old.user_id is null and p_expected_version<>0) or (v_old.user_id is not null and v_old.version<>p_expected_version) then raise exception 'STALE_VERSION'; end if;
 insert into public.weight_entries(user_id,measured_on,kg) values(v_uid,p_date,p_kg) on conflict(user_id,measured_on) do update set kg=excluded.kg,version=public.weight_entries.version+1,updated_at=clock_timestamp() returning * into v_row; return to_jsonb(v_row);
exception when check_violation or numeric_value_out_of_range then raise exception 'INVALID_INPUT'; end $$;

create or replace function public.delete_weight(p_date date,p_expected_version int) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=private.require_member();
begin delete from public.weight_entries where user_id=v_uid and measured_on=p_date and version=p_expected_version; if not found then raise exception 'STALE_VERSION'; end if; return jsonb_build_object('success',true); end $$;

create or replace function public.save_preferences(p_humor_mode text,p_sound_enabled boolean) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=private.require_member(); v_row public.members;
begin if p_humor_mode not in('quiet','locker_room') or p_sound_enabled is null then raise exception 'INVALID_INPUT'; end if; update public.members set humor_mode=p_humor_mode,sound_enabled=p_sound_enabled where user_id=v_uid returning * into v_row; return jsonb_build_object('humor_mode',v_row.humor_mode,'sound_enabled',v_row.sound_enabled); end $$;

create or replace function public.mark_result_seen(p_week_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=private.require_member(); v_seen timestamptz:=clock_timestamp();
begin if not exists(select 1 from public.weekly_results where week_id=p_week_id) then raise exception 'RESULT_NOT_READY'; end if; insert into public.result_views values(p_week_id,v_uid,v_seen) on conflict do nothing; select seen_at into v_seen from public.result_views where week_id=p_week_id and user_id=v_uid; return jsonb_build_object('seen_at',v_seen); end $$;

create or replace function private.previous_score(p_uid uuid,p_before date) returns integer language sql stable security definer set search_path = '' as $$
  select (player->>'score_bp')::int from public.weekly_results r join public.weeks w on w.id=r.week_id
  cross join lateral jsonb_array_elements(r.snapshot->'players') player
  where w.week_start<p_before and r.outcome in('win','tie') and player->>'user_id'=p_uid::text
  order by w.week_start desc limit 1
$$;

create or replace function private.finalize_locked(p_week_id uuid,p_now timestamptz) returns public.weekly_results language plpgsql security definer set search_path = '' as $$
declare w public.weeks; v_players jsonb; v_a int; v_b int; v_outcome text; v_winner uuid; v_reason text; v_margin int; v_snapshot jsonb; v_row public.weekly_results; v_first jsonb; v_second jsonb; v_previous int;
begin
 select * into w from public.weeks where id=p_week_id for update; select * into v_row from public.weekly_results where week_id=p_week_id; if found then return v_row; end if;
 if p_now<w.finalize_at then raise exception 'RESULT_NOT_READY'; end if;
 if w.state='draft' then update public.weeks set state='unranked',unranked_reason='approval_missing' where id=w.id; w.state:='unranked'; w.unranked_reason:='approval_missing'; end if;
 select jsonb_agg(private.live_player(w.id,m.user_id) order by m.slot) into v_players from public.members m;
 v_first:=v_players->0; v_second:=v_players->1; v_a:=(v_first->>'score_bp')::int; v_b:=(v_second->>'score_bp')::int;
 if w.unranked_reason is not null then v_outcome:='no_contest';v_reason:=w.unranked_reason;
 elsif v_a=0 and v_b=0 then v_outcome:='no_contest';v_reason:='no_activity';
 elsif v_a=v_b then v_outcome:='tie';
 else v_outcome:='win';v_winner:=case when v_a>v_b then (v_first->>'user_id')::uuid else (v_second->>'user_id')::uuid end;v_margin:=abs(v_a-v_b); end if;
 if v_outcome<>'no_contest' then
   v_first:=jsonb_set(v_first,'{badges}',(case when v_a>=9000 then '["pact_keeper"]'::jsonb else '[]'::jsonb end)||(case when (v_first#>>'{categories,training,credited}')::int=(v_first#>>'{categories,training,target}')::int then '["training_complete"]'::jsonb else '[]'::jsonb end));
   v_second:=jsonb_set(v_second,'{badges}',(case when v_b>=9000 then '["pact_keeper"]'::jsonb else '[]'::jsonb end)||(case when (v_second#>>'{categories,training,credited}')::int=(v_second#>>'{categories,training,target}')::int then '["training_complete"]'::jsonb else '[]'::jsonb end));
   v_previous:=private.previous_score((v_first->>'user_id')::uuid,w.week_start); if v_previous is not null and v_a>=v_previous+1500 then v_first:=jsonb_set(v_first,'{badges}',(v_first->'badges')||'["comeback"]'); end if;
   v_previous:=private.previous_score((v_second->>'user_id')::uuid,w.week_start); if v_previous is not null and v_b>=v_previous+1500 then v_second:=jsonb_set(v_second,'{badges}',(v_second->'badges')||'["comeback"]'); end if;
   if v_a>=8000 and v_b>=8000 then v_first:=jsonb_set(v_first,'{badges}',(v_first->'badges')||'["double_trouble"]');v_second:=jsonb_set(v_second,'{badges}',(v_second->'badges')||'["double_trouble"]'); end if;
 end if;
 v_players:=jsonb_build_array(v_first,v_second);
 v_snapshot:=jsonb_build_object('schema_version',1,'rules_version',1,'week_id',w.id,'week_start',w.week_start,'timezone','Europe/Bucharest','finalized_at',p_now,'outcome',v_outcome,'no_contest_reason',v_reason,'winner_user_id',v_winner,'margin_bp',coalesce(v_margin,0),'reward_text',w.reward_text,'theme_id',w.theme_id,'players',v_players);
 insert into public.weekly_results values(w.id,1,v_outcome,v_winner,v_snapshot,p_now) returning * into v_row; update public.weeks set state='finalized' where id=w.id; insert into public.audit_events(week_id,event_type,metadata) values(w.id,'finalized',jsonb_build_object('outcome',v_outcome)); return v_row;
end $$;

create or replace function public.finalize_week(p_week_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=private.require_member(); v_now timestamptz; w record; v_row public.weekly_results;
begin perform 1 from public.duel_settings where id=1 for update; v_now:=clock_timestamp();
 for w in select id from public.weeks where finalize_at<=v_now and state<>'finalized' and week_start<=(select week_start from public.weeks where id=p_week_id) order by week_start loop v_row:=private.finalize_locked(w.id,v_now); end loop;
 select * into v_row from public.weekly_results where week_id=p_week_id; if not found then v_row:=private.finalize_locked(p_week_id,v_now); end if; return to_jsonb(v_row);
end $$;

revoke all on function private.require_member() from public,anon,authenticated;
revoke all on function private.create_week(date,timestamptz) from public,anon,authenticated;
revoke all on function private.live_player(uuid,uuid) from public,anon,authenticated;
revoke all on function private.finalize_locked(uuid,timestamptz) from public,anon,authenticated;
revoke all on function private.previous_score(uuid,date) from public,anon,authenticated;
revoke all on function public.sync_duel(),public.save_week_plan(uuid,int,jsonb),public.set_week_reward(uuid,int,text),public.approve_week(uuid,int),public.get_week_summary(uuid),public.save_daily_log(uuid,date,int,uuid,jsonb),public.pause_week(uuid),public.save_weight(date,numeric,int),public.delete_weight(date,int),public.save_preferences(text,boolean),public.mark_result_seen(uuid),public.finalize_week(uuid) from public,anon;
grant execute on function public.sync_duel(),public.save_week_plan(uuid,int,jsonb),public.set_week_reward(uuid,int,text),public.approve_week(uuid,int),public.get_week_summary(uuid),public.save_daily_log(uuid,date,int,uuid,jsonb),public.pause_week(uuid),public.save_weight(date,numeric,int),public.delete_weight(date,int),public.save_preferences(text,boolean),public.mark_result_seen(uuid),public.finalize_week(uuid) to authenticated;
