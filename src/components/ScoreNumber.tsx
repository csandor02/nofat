import { formatScore } from '../lib/scoring-reference';
export function ScoreNumber({ value, small = false }: { value: number; small?: boolean }) {
  return <span className={`display score-number ${small ? 'small' : ''}`}><strong>{formatScore(value)}</strong><span>/ 100</span></span>;
}
