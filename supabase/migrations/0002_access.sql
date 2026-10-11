create or replace function private.is_member()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.members where user_id = auth.uid()) $$;
revoke all on function private.is_member() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_member() to authenticated;

create policy member_read_settings on public.duel_settings for select to authenticated using (private.is_member());
create policy member_read_members on public.members for select to authenticated using (private.is_member());
create policy member_read_weeks on public.weeks for select to authenticated using (private.is_member());
create policy member_read_plans on public.weekly_plans for select to authenticated using (private.is_member());
create policy member_read_approvals on public.week_approvals for select to authenticated using (private.is_member());
create policy own_read_logs on public.daily_logs for select to authenticated using (private.is_member() and user_id = auth.uid());
create policy own_read_weights on public.weight_entries for select to authenticated using (private.is_member() and user_id = auth.uid());
create policy member_read_results on public.weekly_results for select to authenticated using (private.is_member());
create policy own_read_views on public.result_views for select to authenticated using (private.is_member() and user_id = auth.uid());
create policy member_read_audit on public.audit_events for select to authenticated using (private.is_member());

grant select on public.duel_settings, public.members, public.weeks, public.weekly_plans, public.week_approvals,
  public.daily_logs, public.weight_entries, public.weekly_results, public.result_views, public.audit_events to authenticated;
