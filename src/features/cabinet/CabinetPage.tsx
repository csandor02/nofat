import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { EmptyState } from '../../components/EmptyState';
import { Loading } from '../../components/Loading';
import { ScoreNumber } from '../../components/ScoreNumber';
import { requireSupabase } from '../../lib/supabase';
import type { ResultSnapshot } from '../../lib/types';
import './cabinet.css';

export function CabinetPage() {
  const results = useQuery({ queryKey: ['results'], queryFn: async () => { const { data, error } = await requireSupabase().from('weekly_results').select('*').order('finalized_at', { ascending: false }); if (error) throw error; return data; } });
  if (results.isLoading) return <main className="page"><Loading label="Opening the cabinet..." /></main>;
  return <main className="page"><header className="section-hero"><p className="eyebrow">Permanent record</p><h1 className="display">The cabinet of <em>receipts.</em></h1><p>Final accounts, earned laurels, and an entirely reasonable archive of bragging rights.</p></header>
    {results.error ? <p className="error">The history could not be loaded.</p> : !results.data?.length ? <div className="card"><EmptyState title="The shelves await their first result">Once a week is finalized, its immutable account will live here.</EmptyState></div> : <div className="result-list">{results.data.map((row) => { const snapshot = row.snapshot as unknown as ResultSnapshot; return <article className="card result-row" key={row.week_id}><div><p className="eyebrow">Week of {snapshot.week_start}</p><h2 className="display">{snapshot.outcome === 'win' ? `${snapshot.players.find((p) => p.user_id === snapshot.winner_user_id)?.display_name} prevailed` : snapshot.outcome === 'tie' ? 'Honours even' : 'No contest'}</h2><p>{snapshot.outcome === 'no_contest' ? 'A neutral account. No laurels awarded.' : snapshot.reward_text}</p></div><div className="result-scores">{snapshot.players.map((player) => <span key={player.user_id}><small>{player.display_name}</small><ScoreNumber value={player.score_bp} small /></span>)}</div><Link className="button secondary" to={`/ceremony/${row.week_id}`}>View account</Link></article>; })}</div>}
  </main>;
}
