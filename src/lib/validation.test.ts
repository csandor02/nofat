import { describe, expect, it } from 'vitest';
import { dailyLogSchema, loginSchema, weekPlanSchema, weightEntrySchema } from './validation';

const starterPlan = {
  training_target: 2, training_description: 'Planned workout', nutrition_mode: 'habit' as const,
  nutrition_target_days: 7, nutrition_description: 'Eat planned meals', calorie_min: null, calorie_max: null,
  walking_minutes_target: 15, walking_target_days: 5, recovery_target_days: 5,
  recovery_description: 'Wind-down routine', weekly_kcal_budget: null,
};

describe('client input validation', () => {
  it('requires the four-digit member code', () => {
    expect(loginSchema.safeParse({ member: 'catalina', code: '2000' }).success).toBe(true);
    expect(loginSchema.safeParse({ member: 'catalina', code: '20x0' }).success).toBe(false);
  });

  it('rejects fractional and out-of-range check-in values', () => {
    const valid = { training_done: false, nutrition_habit_done: false, actual_kcal: null, walking_minutes: 20, recovery_done: false, private_note: null };
    expect(dailyLogSchema.safeParse(valid).success).toBe(true);
    expect(dailyLogSchema.safeParse({ ...valid, walking_minutes: 20.5 }).success).toBe(false);
    expect(dailyLogSchema.safeParse({ ...valid, actual_kcal: 20_001 }).success).toBe(false);
  });

  it('validates nutrition bands and the optional weekly budget', () => {
    expect(weekPlanSchema.safeParse({ ...starterPlan, weekly_kcal_budget: 14_000 }).success).toBe(true);
    expect(weekPlanSchema.safeParse({ ...starterPlan, weekly_kcal_budget: 0 }).success).toBe(false);
    expect(weekPlanSchema.safeParse({ ...starterPlan, nutrition_mode: 'calorie_band', calorie_min: 2_000, calorie_max: 1_800 }).success).toBe(false);
    expect(weekPlanSchema.safeParse({ ...starterPlan, nutrition_mode: 'calorie_band', calorie_min: 1_800, calorie_max: 2_000 }).success).toBe(true);
  });

  it('validates positive kg values with at most two decimals', () => {
    expect(weightEntrySchema.safeParse({ measured_on: '2026-10-12', kg: 72.35 }).success).toBe(true);
    expect(weightEntrySchema.safeParse({ measured_on: '2026-10-12', kg: 72.351 }).success).toBe(false);
    expect(weightEntrySchema.safeParse({ measured_on: '2026-10-12', kg: 0 }).success).toBe(false);
  });
});
