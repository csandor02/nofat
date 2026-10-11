import { describe, expect, it } from 'vitest';
import { categoryScore, formatScore, scorePlan } from './scoring-reference';

describe('fixed-budget scoring', () => {
  it('matches the worked Catalina fixture', () => expect(scorePlan({ training: { credited: 3, target: 4 }, nutrition: { credited: 6, target: 7 }, walking: { credited: 5, target: 5 }, recovery: { credited: 4, target: 5 } })).toBe(8371));
  it('matches the worked Cristian fixture', () => expect(scorePlan({ training: { credited: 3, target: 3 }, nutrition: { credited: 5, target: 7 }, walking: { credited: 3, target: 5 }, recovery: { credited: 3, target: 5 } })).toBe(7942));
  it('caps extra work', () => expect(categoryScore(4000, 3, 2)).toBe(4000));
  it('floors each category', () => expect(categoryScore(3000, 1, 7)).toBe(428));
  it('formats exactly two decimals', () => expect(formatScore(8371)).toBe('83.71'));
  it('rejects a zero target', () => expect(() => categoryScore(4000, 1, 0)).toThrow());
});
