import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { Link, useParams } from 'react-router';
import { api } from '../../lib/api';
import { requireSupabase } from '../../lib/supabase';
import type { ResultSnapshot } from '../../lib/types';
import { Loading } from '../../components/Loading';
import { ScoreNumber } from '../../components/ScoreNumber';
import { selectMeme } from '../../content/memes';
import './ceremony.css';

export function CeremonyPage() {
  const { weekId = '' } = useParams(); const reduced = useReducedMotion(); const [skipped, setSkipped] = useState(false); const [replay, setReplay] = useState(0);
  const result = useQuery({ queryKey: ['result', weekId], queryFn: async () => { const { data, error } = await requireSupabase().from('weekly_results').select('*').eq('week_id', weekId).single(); if (error) throw error; return data.snapshot as unknown as ResultSnapshot; } });
  const markSeen = useMutation({ mutationFn: () => api.markResultSeen(weekId) });
  const finished = reduced || skipped;
  useEffect(() => { if (finished && result.data && !markSeen.isSuccess && !markSeen.isPending) markSeen.mutate(); }, [finished, result.data, markSeen]);
  if (result.isLoading) return <main className="ceremony-page"><Loading label="Preparing the weekly account..." /></main>;
  if (!result.data) return <main className="ceremony-page"><p className="eyebrow">Result unavailable</p><h1 className="display">The account is not ready.</h1><Link to="/today">Return to today</Link></main>;
  const snapshot = result.data; const winner = snapshot.players.find((player) => player.user_id === snapshot.winner_user_id); const title = snapshot.outcome === 'win' ? `${winner?.display_name} takes the week` : snapshot.outcome === 'tie' ? 'Honours even' : 'The ledger rests'; const meme = selectMeme(`${weekId}${snapshot.finalized_at}`, snapshot.outcome === 'no_contest' ? 'no_contest' : snapshot.outcome, 'locker_room');
  return <main className="ceremony-page" key={replay}>
    {!finished && <button className="ceremony-skip" onClick={() => setSkipped(true)}>Skip ceremony</button>}
    <motion.div className="ceremony-title" initial={finished ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .5 }}><p className="eyebrow">3DIGIT CLUB presents</p><h1 className="display">The week's account</h1></motion.div>
    <motion.section className={`ceremony-stage ${snapshot.outcome}`} initial={finished ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: finished ? 0 : 1, duration: .7 }} onAnimationComplete={() => { if (!markSeen.isSuccess) markSeen.mutate(); }} aria-live="polite">
      <div className="ceremony-players">{snapshot.players.map((player) => { const won = snapshot.winner_user_id === player.user_id; return <motion.article key={player.user_id} animate={{ y: won && !finished ? -14 : 0 }} transition={{ delay: 3, duration: .6 }}><div className={`ceremony-medallion ${won ? 'winner' : ''}`}><span>{player.display_name === 'Catalina' ? 'CA' : 'CR'}</span></div><h2 className="display">{player.display_name}</h2><ScoreNumber value={player.score_bp}/>{won && <div className="laurel" aria-hidden="true">❧</div>}</motion.article>; })}</div>
      <motion.div className="ceremony-summary" initial={finished ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: finished ? 0 : 4.5, duration: .7 }}><p className="eyebrow">Official result</p><h2 className="display">{title}</h2>{snapshot.outcome === 'win' && <p>Margin: {(snapshot.margin_bp / 100).toFixed(2)} points</p>}<blockquote className="display">“{meme.text}”</blockquote></motion.div>
    </motion.section>
    <motion.div className="ceremony-actions" initial={finished ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: finished ? 0 : 6 }}><button className="button secondary" onClick={() => { setSkipped(false); setReplay((value) => value + 1); }}>Replay</button><Link className="button" to="/pact">Next pact</Link><Link className="button ghost" to="/cabinet">Open cabinet</Link></motion.div>
  </main>;
}
