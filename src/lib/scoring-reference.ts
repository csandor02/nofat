import type { CategoryKey } from './types';

export const CATEGORY_WEIGHTS: Record<CategoryKey, number> = { training: 4000, nutrition: 3000, walking: 2000, recovery: 1000 };

export function categoryScore(weightBp: number, credited: number, target: number) {
  if (!Number.isInteger(target) || target <= 0) throw new Error('Target must be a positive integer.');
  return Math.floor(weightBp * Math.min(Math.max(credited, 0), target) / target);
}

export function scorePlan(values: Record<CategoryKey, { credited: number; target: number }>) {
  return (Object.keys(CATEGORY_WEIGHTS) as CategoryKey[]).reduce((total, key) => total + categoryScore(CATEGORY_WEIGHTS[key], values[key].credited, values[key].target), 0);
}

export function formatScore(bp: number) { return (bp / 100).toFixed(2); }
