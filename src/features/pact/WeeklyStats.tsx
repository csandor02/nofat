import type { CSSProperties } from 'react';
import type { CategoryKey, PlayerResult } from '../../lib/types';

const categoryNames: Record<CategoryKey, string> = { training: 'Training', nutrition: 'Nutrition', walking: 'Walking', recovery: 'Recovery' };
const categoryColors: Record<CategoryKey, string> = { training: '#29483d', nutrition: '#a5533b', walking: '#8b6c3b', recovery: '#8a9385' };

function donutGradient(player: PlayerResult) {
  const keys: CategoryKey[] = ['training', 'nutrition', 'walking', 'recovery'];
  const total = player.score_bp;
  if (!total) return 'conic-gradient(var(--quiet-fill) 0deg 360deg)';
  let angle = 0;
  const slices = keys.map((key) => {
    const start = angle; angle += player.categories[key].earned_bp / total * 360;
    return `${categoryColors[key]} ${start}deg ${angle}deg`;
  });
  return `conic-gradient(${slices.join(',')})`;
}

export function WeeklyStats({ players }: { players: [PlayerResult, PlayerResult] }) {
  return <section className="weekly-stats" aria-label="Current weekly statistics">
    <div className="weekly-stats-heading"><div><p className="eyebrow">The numbers, tastefully arranged</p><h2 className="display">Weekly form</h2></div><span>Live · provisional</span></div>
    <div className="weekly-stats-grid">{players.map((player) => <article className="card stats-player" key={player.user_id}>
      <div className="stats-player-header"><div><p className="eyebrow">{player.display_name}</p><h3 className="display">Commitment mix</h3></div><div className="stats-donut" style={{ background: donutGradient(player) } as CSSProperties} role="img" aria-label={`${player.display_name}: ${player.score_bp / 100} points, split across category points`}><span><strong className="score">{(player.score_bp / 100).toFixed(0)}</strong><small>pts</small></span></div></div>
      <div className="stats-bars">{(Object.keys(categoryNames) as CategoryKey[]).map((key) => { const category = player.categories[key]; const percent = category.target ? Math.min(100, category.credited / category.target * 100) : 0; return <div className="stats-bar-row" key={key}><span>{categoryNames[key]}</span><div className="stats-bar-track"><i style={{ width: `${percent}%`, background: categoryColors[key] }}/></div><strong className="score">{category.credited}/{category.target}</strong></div>; })}</div>
      <p className="stats-caption">Pie slices show earned points by category. Bars show agreed dates completed.</p>
    </article>)}</div>
  </section>;
}
