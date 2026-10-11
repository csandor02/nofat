drop policy if exists own_read_weights on public.weight_entries;
create policy member_read_weights on public.weight_entries for select to authenticated using (private.is_member());

create or replace function public.get_shared_stats() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_member();
  return jsonb_build_object('players',(
    select jsonb_agg(jsonb_build_object(
      'user_id',m.user_id,
      'display_name',m.display_name,
      'weights',(select coalesce(jsonb_agg(jsonb_build_object('measured_on',we.measured_on,'kg',we.kg) order by we.measured_on),'[]'::jsonb) from public.weight_entries we where we.user_id=m.user_id),
      'daily',(select coalesce(jsonb_agg(jsonb_build_object('week_id',dl.week_id,'log_date',dl.log_date,'training_done',dl.training_done,'nutrition_habit_done',dl.nutrition_habit_done,'actual_kcal',dl.actual_kcal,'walking_minutes',dl.walking_minutes,'recovery_done',dl.recovery_done) order by dl.log_date,dl.week_id),'[]'::jsonb) from public.daily_logs dl where dl.user_id=m.user_id)
    ) order by m.slot)
    from public.members m
  ));
end $$;

revoke all on function public.get_shared_stats() from public,anon;
grant execute on function public.get_shared_stats() to authenticated;
