begin;
select plan(15);

select has_table('public','duel_settings','duel_settings table exists');
select has_table('public','members','members table exists');
select has_table('public','weeks','weeks table exists');
select has_table('public','weekly_plans','weekly_plans table exists');
select has_table('public','week_approvals','week_approvals table exists');
select has_table('public','daily_logs','daily_logs table exists');
select has_table('public','weight_entries','weight_entries table exists');
select has_table('public','weekly_results','weekly_results table exists');
select has_table('public','result_views','result_views table exists');
select has_table('public','audit_events','audit_events table exists');
select ok((select relrowsecurity from pg_class where oid='public.members'::regclass),'members has RLS');
select ok((select relrowsecurity from pg_class where oid='public.daily_logs'::regclass),'daily_logs has RLS');
select ok((select relrowsecurity from pg_class where oid='public.weight_entries'::regclass),'weight_entries has RLS');
select has_function('public','sync_duel',array[]::text[]);
select has_function('public','finalize_week',array['uuid']);

select * from finish();
rollback;
