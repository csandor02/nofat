import { ScoreNumber } from '../../components/ScoreNumber';
import type { PlayerResult } from '../../lib/types';

const labels = { training: 'Training', nutrition: 'Nutrition', walking: 'Walking', recovery: 'Recovery' } as const;
export function DuelCard({ players, ranked }: { players: [PlayerResult, PlayerResult]; ranked: boolean }) {
  const leader = players[0].score_bp === players[1].score_bp ? null : players[0].score_bp > players[1].score_bp ? players[0].user_id : players[1].user_id;
  return <section className="card duel-card" aria-labelledby="duel-title">
    <div className="card-heading"><div><p className="eyebrow">The duel</p><h2 id="duel-title" className="display">This week's account</h2></div><span className="status">{ranked ? 'Provisional' : 'Unranked'}</span></div>
    <div className="players">
      {players.map((player, index) => <article className="player" key={player.user_id}>
        <div className="monogram" aria-hidden="true">{player.display_name === 'Catalina' ? 'CA' : 'CR'}</div>
        <div><p className="player-name">{player.display_name}</p><ScoreNumber value={player.score_bp} /></div>
        {ranked && leader === player.user_id && <span className="leading">Leading</span>}
        <div className="score-bar" aria-hidden="true"><i style={{ width: `${player.score_bp / 100}%` }} /></div>
        <div className="category-list">{Object.entries(player.categories).map(([key, category]) => <div key={key}><span>{labels[key as keyof typeof labels]}</span><strong className="score">{category.credited}/{category.target}</strong></div>)}</div>
        {index === 0 && <span className="versus" aria-hidden="true">vs</span>}
      </article>)}
    </div>
    <p className="duel-note">Scores reflect completion of each person's agreed plan. Extra work earns admiration, not extra points.</p>
  </section>;
}
