import { z } from 'zod';
import { requireSupabase } from './supabase';
import type { DailyLog, DuelBootstrap, ResultSnapshot, SharedStats, WeekPlan, WeekSummary, WeightEntry } from './types';

const jsonRecord = z.record(z.string(), z.unknown());

export class ApiError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = 'ApiError'; }
}

function mapError(error: { message: string; code?: string | null }) {
  const known = ['NOT_MEMBER', 'SETUP_INCOMPLETE', 'STALE_REVISION', 'STALE_VERSION', 'PLAN_LOCKED', 'APPROVAL_CLOSED', 'LOG_WINDOW_CLOSED', 'FUTURE_DATE', 'RESULT_NOT_READY', 'INVALID_INPUT', 'REQUEST_REUSED'];
  const code = known.find((item) => error.message.includes(item)) ?? error.code ?? 'NETWORK_ERROR';
  const messages: Record<string, string> = {
    NOT_MEMBER: 'This club is for Catalina and Cristian.',
    STALE_REVISION: 'The pact changed in another session. Review the latest revision.',
    STALE_VERSION: 'This entry changed in another tab. Review the latest version.',
    LOG_WINDOW_CLOSED: 'The correction window for this date has closed.',
    RESULT_NOT_READY: 'The official result is not ready yet.',
    INVALID_INPUT: 'Please review the highlighted fields. One or more values are invalid.',
    42803: 'The weekly summary could not be calculated. Please refresh and try again.',
    NETWORK_ERROR: 'The club ledger could not be reached. Your changes were not saved.',
  };
  return new ApiError(code, messages[code] ?? (error.code ? 'The club could not process that request. Please review your entries and try again.' : 'The request could not be completed.'));
}

async function rpc(name: keyof import('./database.types').Database['public']['Functions'], args: Record<string, unknown> = {}) {
  const client = requireSupabase();
  const call = client.rpc as unknown as (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
  // Supabase RPC methods rely on their client instance (`this.rest`); retain the receiver.
  const { data, error } = await call.call(client, name, args);
  if (error) throw mapError(error);
  return data;
}

function object<T>(value: unknown) { return jsonRecord.parse(value) as T; }

export const api = {
  syncDuel: async () => object<DuelBootstrap>(await rpc('sync_duel')),
  getSharedStats: async () => object<SharedStats>(await rpc('get_shared_stats')),
  getWeekSummary: async (weekId: string) => object<WeekSummary>(await rpc('get_week_summary', { p_week_id: weekId })),
  saveWeekPlan: async (weekId: string, revision: number, plan: Omit<WeekPlan, 'user_id' | 'display_name'>) => object<{ revision: number }>(await rpc('save_week_plan', { p_week_id: weekId, p_expected_revision: revision, p_plan: plan })),
  setWeekReward: async (weekId: string, revision: number, text: string) => object<{ revision: number }>(await rpc('set_week_reward', { p_week_id: weekId, p_expected_revision: revision, p_text: text })),
  approveWeek: async (weekId: string, revision: number) => object<{ state: string; approvals?: number; locked_at?: string | null }>(await rpc('approve_week', { p_week_id: weekId, p_revision: revision })),
  saveDailyLog: async (weekId: string, date: string, version: number, requestId: string, values: Omit<DailyLog, 'week_id' | 'user_id' | 'log_date' | 'version'>) => object<DailyLog>(await rpc('save_daily_log', { p_week_id: weekId, p_date: date, p_expected_version: version, p_request_id: requestId, p_values: values })),
  pauseWeek: async (weekId: string) => object<{ state: string }>(await rpc('pause_week', { p_week_id: weekId })),
  finalizeWeek: async (weekId: string) => object<{ snapshot: ResultSnapshot }>(await rpc('finalize_week', { p_week_id: weekId })),
  markResultSeen: async (weekId: string) => object<{ seen_at: string }>(await rpc('mark_result_seen', { p_week_id: weekId })),
  saveWeight: async (date: string, kg: number, version: number) => object<WeightEntry>(await rpc('save_weight', { p_date: date, p_kg: kg, p_expected_version: version })),
  deleteWeight: async (date: string, version: number) => object<{ success: boolean }>(await rpc('delete_weight', { p_date: date, p_expected_version: version })),
  savePreferences: async (humorMode: string, soundEnabled: boolean) => object(await rpc('save_preferences', { p_humor_mode: humorMode, p_sound_enabled: soundEnabled })),
};
