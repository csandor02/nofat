create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

create table public.duel_settings (
  id smallint primary key check (id = 1),
  timezone text not null default 'Europe/Bucharest' check (timezone = 'Europe/Bucharest'),
  created_at timestamptz not null default now()
);
insert into public.duel_settings (id) values (1);

create table public.members (
  user_id uuid primary key references auth.users(id) on delete restrict,
  slot smallint unique not null check (slot in (1, 2)),
  display_name text not null,
  humor_mode text not null default 'locker_room' check (humor_mode in ('quiet', 'locker_room')),
  sound_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  check ((slot = 1 and display_name = 'Catalina') or (slot = 2 and display_name = 'Cristian'))
);

create table public.weeks (
  id uuid primary key default extensions.gen_random_uuid(),
  week_start date unique not null check (extract(isodow from week_start) = 1),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  approval_deadline timestamptz not null,
  finalize_at timestamptz not null,
  state text not null check (state in ('draft', 'active', 'unranked', 'finalized')),
  unranked_reason text check (unranked_reason in ('setup_midweek', 'approval_missing', 'recovery_pause')),
  revision integer not null default 1 check (revision > 0),
  rules_version integer not null default 1 check (rules_version = 1),
  locked_at timestamptz,
  reward_text text not null default 'Winner chooses the next shared activity.' check (char_length(reward_text) between 1 and 160),
  theme_id text not null check (theme_id in ('keep_your_word', 'ordinary_excellence', 'long_game', 'quiet_work')),
  created_at timestamptz not null default now(),
  check (state <> 'active' or (locked_at is not null and unranked_reason is null)),
  check (ends_at > starts_at and approval_deadline > starts_at and finalize_at > ends_at)
);

create table public.weekly_plans (
  week_id uuid not null references public.weeks(id) on delete cascade,
  user_id uuid not null references public.members(user_id) on delete restrict,
  training_target integer not null check (training_target between 1 and 5),
  training_description text not null check (char_length(btrim(training_description)) between 1 and 160),
  nutrition_mode text not null check (nutrition_mode in ('habit', 'calorie_band')),
  nutrition_target_days integer not null check (nutrition_target_days between 1 and 7),
  nutrition_description text not null check (char_length(btrim(nutrition_description)) between 1 and 160),
  calorie_min integer,
  calorie_max integer,
  walking_minutes_target integer not null check (walking_minutes_target between 5 and 120),
  walking_target_days integer not null check (walking_target_days between 1 and 7),
  recovery_target_days integer not null check (recovery_target_days between 1 and 7),
  recovery_description text not null check (char_length(btrim(recovery_description)) between 1 and 160),
  primary key (week_id, user_id),
  check ((nutrition_mode = 'habit' and calorie_min is null and calorie_max is null) or
    (nutrition_mode = 'calorie_band' and calorie_min > 0 and calorie_min <= calorie_max and calorie_max <= 20000))
);

create table public.week_approvals (
  week_id uuid not null references public.weeks(id) on delete cascade,
  user_id uuid not null references public.members(user_id) on delete restrict,
  approved_revision integer not null check (approved_revision > 0),
  approved_at timestamptz not null,
  primary key (week_id, user_id)
);

create table public.daily_logs (
  week_id uuid not null references public.weeks(id) on delete restrict,
  user_id uuid not null references public.members(user_id) on delete restrict,
  log_date date not null,
  training_done boolean not null default false,
  nutrition_habit_done boolean not null default false,
  actual_kcal integer check (actual_kcal between 0 and 20000),
  walking_minutes integer check (walking_minutes between 0 and 1440),
  recovery_done boolean not null default false,
  private_note text check (char_length(private_note) <= 500),
  version integer not null default 1 check (version > 0),
  last_request_id uuid not null,
  request_fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (week_id, user_id, log_date)
);

create table public.weight_entries (
  user_id uuid not null references public.members(user_id) on delete restrict,
  measured_on date not null,
  kg numeric(6,2) not null check (kg > 0 and kg < 1000),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, measured_on)
);

create table public.weekly_results (
  week_id uuid primary key references public.weeks(id) on delete restrict,
  rules_version integer not null,
  outcome text not null check (outcome in ('win', 'tie', 'no_contest')),
  winner_user_id uuid references public.members(user_id) on delete restrict,
  snapshot jsonb not null,
  finalized_at timestamptz not null,
  check ((outcome = 'win') = (winner_user_id is not null))
);

create table public.result_views (
  week_id uuid not null references public.weekly_results(week_id) on delete restrict,
  user_id uuid not null references public.members(user_id) on delete restrict,
  seen_at timestamptz not null,
  primary key (week_id, user_id)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  week_id uuid not null references public.weeks(id) on delete restrict,
  actor_user_id uuid references public.members(user_id) on delete restrict,
  event_type text not null check (event_type in ('plan_changed', 'reward_changed', 'approved', 'locked', 'log_saved', 'unranked', 'finalized')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index weeks_state_finalize_idx on public.weeks (state, finalize_at);
create index daily_logs_user_date_idx on public.daily_logs (user_id, log_date);
create index audit_events_week_created_idx on public.audit_events (week_id, created_at);

alter table public.duel_settings enable row level security;
alter table public.members enable row level security;
alter table public.weeks enable row level security;
alter table public.weekly_plans enable row level security;
alter table public.week_approvals enable row level security;
alter table public.daily_logs enable row level security;
alter table public.weight_entries enable row level security;
alter table public.weekly_results enable row level security;
alter table public.result_views enable row level security;
alter table public.audit_events enable row level security;

revoke all on all tables in schema public from anon, authenticated;
