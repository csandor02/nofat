export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      members: Table<{ user_id: string; slot: number; display_name: string; humor_mode: string; sound_enabled: boolean; created_at: string }>;
      weekly_plans: Table<{ week_id: string; user_id: string; training_target: number; training_description: string; nutrition_mode: string; nutrition_target_days: number; nutrition_description: string; calorie_min: number | null; calorie_max: number | null; walking_minutes_target: number; walking_target_days: number; recovery_target_days: number; recovery_description: string; weekly_kcal_budget: number | null }>;
      daily_logs: Table<{ week_id: string; user_id: string; log_date: string; training_done: boolean; nutrition_habit_done: boolean; actual_kcal: number | null; walking_minutes: number | null; recovery_done: boolean; private_note: string | null; version: number; last_request_id: string; request_fingerprint: string; created_at: string; updated_at: string }>;
      weight_entries: Table<{ user_id: string; measured_on: string; kg: number; version: number; created_at: string; updated_at: string }>;
      weekly_results: Table<{ week_id: string; rules_version: number; outcome: string; winner_user_id: string | null; snapshot: Json; finalized_at: string }>;
    };
    Views: Record<string, never>;
    Functions: {
      sync_duel: { Args: Record<PropertyKey, never>; Returns: Json };
      get_shared_stats: { Args: Record<PropertyKey, never>; Returns: Json };
      get_week_summary: { Args: { p_week_id: string }; Returns: Json };
      save_week_plan: { Args: { p_week_id: string; p_expected_revision: number; p_plan: Json }; Returns: Json };
      set_week_reward: { Args: { p_week_id: string; p_expected_revision: number; p_text: string }; Returns: Json };
      approve_week: { Args: { p_week_id: string; p_revision: number }; Returns: Json };
      save_daily_log: { Args: { p_week_id: string; p_date: string; p_expected_version: number; p_request_id: string; p_values: Json }; Returns: Json };
      pause_week: { Args: { p_week_id: string }; Returns: Json };
      finalize_week: { Args: { p_week_id: string }; Returns: Json };
      mark_result_seen: { Args: { p_week_id: string }; Returns: Json };
      save_weight: { Args: { p_date: string; p_kg: number; p_expected_version: number }; Returns: Json };
      delete_weight: { Args: { p_date: string; p_expected_version: number }; Returns: Json };
      save_preferences: { Args: { p_humor_mode: string; p_sound_enabled: boolean }; Returns: Json };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
