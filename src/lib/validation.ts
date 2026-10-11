import { z } from 'zod';

const integer = (min: number, max: number) => z.number().int().min(min).max(max);
const shortText = z.string().trim().min(1, 'This field is required.').max(160, 'Use 160 characters or fewer.');

export const loginSchema = z.object({ member: z.enum(['catalina', 'cristian']), code: z.string().regex(/^\d{4}$/, 'Enter your four-digit club code.') });

export const dailyLogSchema = z.object({
  training_done: z.boolean(), nutrition_habit_done: z.boolean(),
  actual_kcal: integer(0, 20000).nullable(), walking_minutes: integer(0, 1440).nullable(),
  recovery_done: z.boolean(), private_note: z.string().max(500, 'Notes must be 500 characters or fewer.').nullable(),
});

export const weekPlanSchema = z.object({
  training_target: integer(1, 5), training_description: shortText,
  nutrition_mode: z.enum(['habit', 'calorie_band']), nutrition_target_days: integer(1, 7), nutrition_description: shortText,
  calorie_min: integer(0, 20000).nullable(), calorie_max: integer(0, 20000).nullable(),
  walking_minutes_target: integer(5, 120), walking_target_days: integer(1, 7),
  recovery_target_days: integer(1, 7), recovery_description: shortText,
  weekly_kcal_budget: integer(1, 140000).nullable(),
}).superRefine((plan, context) => {
  if (plan.nutrition_mode === 'habit' && (plan.calorie_min !== null || plan.calorie_max !== null)) {
    context.addIssue({ code: 'custom', path: ['nutrition_mode'], message: 'Habit mode cannot include calorie range values.' });
  }
  if (plan.nutrition_mode === 'calorie_band' && (plan.calorie_min === null || plan.calorie_max === null || plan.calorie_min <= 0 || plan.calorie_min > plan.calorie_max)) {
    context.addIssue({ code: 'custom', path: ['calorie_min'], message: 'Enter a valid positive calorie range with minimum no greater than maximum.' });
  }
});

export const weightEntrySchema = z.object({
  measured_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date.').refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Choose a real calendar date.'),
  kg: z.number().finite().positive().max(999.99).refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, 'Use no more than two decimal places.'),
});

export function validationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Please check the highlighted values.';
}
