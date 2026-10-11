export type CategoryKey = 'training' | 'nutrition' | 'walking' | 'recovery';
export type HumorMode = 'quiet' | 'locker_room';
export type ThemeId = 'keep_your_word' | 'ordinary_excellence' | 'long_game' | 'quiet_work';

export type CategoryResult = {
  credited: number;
  target: number;
  weight_bp: number;
  earned_bp: number;
  description: string;
};

export type PlayerResult = {
  user_id: string;
  display_name: 'Catalina' | 'Cristian';
  score_bp: number;
  categories: Record<CategoryKey, CategoryResult>;
  daily: Array<{ date: string; training: boolean; nutrition: boolean; walking: boolean; recovery: boolean }>;
  badges: Array<'pact_keeper' | 'training_complete' | 'comeback' | 'double_trouble'>;
};

export type ResultSnapshot = {
  schema_version: 1;
  rules_version: 1;
  week_id: string;
  week_start: string;
  timezone: 'Europe/Bucharest';
  finalized_at: string;
  outcome: 'win' | 'tie' | 'no_contest';
  no_contest_reason: null | 'setup_midweek' | 'approval_missing' | 'recovery_pause' | 'no_activity';
  winner_user_id: string | null;
  margin_bp: number;
  reward_text: string;
  theme_id: ThemeId;
  players: [PlayerResult, PlayerResult];
};

export type WeekPlan = {
  user_id: string;
  display_name: 'Catalina' | 'Cristian';
  training_target: number;
  training_description: string;
  nutrition_mode: 'habit' | 'calorie_band';
  nutrition_target_days: number;
  nutrition_description: string;
  calorie_min: number | null;
  calorie_max: number | null;
  walking_minutes_target: number;
  walking_target_days: number;
  recovery_target_days: number;
  recovery_description: string;
  weekly_kcal_budget: number | null;
};

export type WeekSummary = {
  week_id: string;
  week_start: string;
  state: 'draft' | 'active' | 'unranked' | 'finalized';
  stage: 'planning' | 'scheduled' | 'live' | 'corrections' | 'ready_to_finalize' | 'finalized';
  ranked: boolean;
  revision: number;
  reward_text: string;
  server_now: string;
  starts_at: string;
  ends_at: string;
  approval_deadline: string;
  finalize_at: string;
  locked_at: string | null;
  unranked_reason: string | null;
  plans: [WeekPlan, WeekPlan];
  approvals: Array<{ user_id: string; approved_revision: number; approved_at: string }>;
  players: [PlayerResult, PlayerResult];
  result: ResultSnapshot | null;
};

export type DuelBootstrap = {
  server_now: string;
  current_week_id: string;
  next_week_id: string | null;
  editable_dates: Array<{ date: string; week_id: string; editable_until: string }>;
  unseen_result_ids: string[];
};

export type DailyLog = {
  week_id: string;
  user_id: string;
  log_date: string;
  training_done: boolean;
  nutrition_habit_done: boolean;
  actual_kcal: number | null;
  walking_minutes: number | null;
  recovery_done: boolean;
  private_note: string | null;
  version: number;
};

export type WeightEntry = { user_id: string; measured_on: string; kg: number; version: number };

export type SharedDailyStat = {
  week_id: string;
  log_date: string;
  training_done: boolean;
  nutrition_habit_done: boolean;
  actual_kcal: number | null;
  walking_minutes: number | null;
  recovery_done: boolean;
};

export type SharedPlayerStats = {
  user_id: string;
  display_name: 'Catalina' | 'Cristian';
  weights: Array<{ measured_on: string; kg: number }>;
  daily: SharedDailyStat[];
};

export type SharedStats = { players: [SharedPlayerStats, SharedPlayerStats] };
