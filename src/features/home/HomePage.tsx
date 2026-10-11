import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, Download, GitCommitHorizontal, Scale } from 'lucide-react';
import { useAuth } from '../../app/providers';
import { useBootstrap } from '../../app/useClubData';
import { EmptyState } from '../../components/EmptyState';
import { Loading } from '../../components/Loading';
import { api } from '../../lib/api';
import { bucharestDate, formatDate } from '../../lib/dates';
import { requireSupabase } from '../../lib/supabase';
import type { ResultSnapshot, WeightEntry } from '../../lib/types';
import { weightEntrySchema, validationMessage } from '../../lib/validation';
import { notify } from '../../lib/notifications';
import { WeightTrend } from './WeightTrend';
import './home.css';

type ResultRow = { week_id: string; outcome: string; snapshot: ResultSnapshot; finalized_at: string };

function WeightMemberCard({ name, entries, isOwn }: { name: 'Catalina' | 'Cristian'; entries: Array<{ measured_on: string; kg: number }>; isOwn: boolean }) {
  const first = entries[0]; const latest = entries.at(-1);
  const delta = first && latest ? Number(latest.kg) - Number(first.kg) : null;
  return <article className="shared-member-weight"><div className="member-weight-heading"><div><p className="eyebrow">{name}{isOwn ? ' · You' : ''}</p><h3 className="display">Weight trend</h3></div>{latest ? <div className="weight-stat"><strong className="display score">{Number(latest.kg).toFixed(2)}<small> kg</small></strong>{delta !== null && <span className={delta <= 0 ? 'weight-down' : 'weight-up'}>{delta <= 0 ? <ArrowDownRight size={14}/> : <ArrowUpRight size={14}/>} {delta > 0 ? '+' : ''}{delta.toFixed(2)} kg from first reading</span>}</div> : <span className="muted">No entries</span>}</div><WeightTrend entries={entries} playerName={name}/></article>;
}

async function fetchAll(table: 'daily_logs' | 'weight_entries' | 'weekly_plans' | 'weekly_results', userId: string) {
  const rows: unknown[] = []; const size = 500;
  for (let from = 0; ; from += size) {
    const client = requireSupabase();
    let data: unknown[] | null; let error: { message: string } | null;
    if (table === 'weekly_results') {
      const response = await client.from('weekly_results').select('*').range(from, from + size - 1);
      data = response.data; error = response.error;
    } else if (table === 'daily_logs') {
      const response = await client.from('daily_logs').select('*').eq('user_id', userId).range(from, from + size - 1);
      data = response.data; error = response.error;
    } else if (table === 'weight_entries') {
      const response = await client.from('weight_entries').select('*').eq('user_id', userId).range(from, from + size - 1);
      data = response.data; error = response.error;
    } else {
      const response = await client.from('weekly_plans').select('*').eq('user_id', userId).range(from, from + size - 1);
      data = response.data; error = response.error;
    }
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return rows;
}

function CommitWall({ rows, loading, error }: { rows: ResultRow[]; loading: boolean; error: Error | null }) {
  if (loading) return <Loading label="Reading the club record..." />;
  if (error) return <p className="error" role="alert">The club history could not be loaded. {error.message}</p>;
  if (!rows.length) return <EmptyState title="The first win is still unwritten">Finalized weekly results will appear here as a wall of club commits.</EmptyState>;

  return <div className="commit-wall">{rows.map((row) => {
    const snapshot = row.snapshot;
    const winner = snapshot.players.find((player) => player.user_id === snapshot.winner_user_id);
    const winnerClass = winner?.display_name === 'Catalina' ? 'catalina' : winner?.display_name === 'Cristian' ? 'cristian' : 'neutral';
    const headline = snapshot.outcome === 'win' ? `${winner?.display_name} wins the week` : snapshot.outcome === 'tie' ? 'A dead heat' : 'No contest';
    return <article className={`commit-entry ${winnerClass}`} key={row.week_id}>
      <div className="commit-rail"><span className="commit-node"><GitCommitHorizontal size={17} /></span></div>
      <div className="commit-content">
        <div className="commit-meta"><span>{formatDate(snapshot.week_start, { month: 'short' })} week</span><span aria-hidden="true">·</span><code>{row.week_id.replaceAll('-', '').slice(0, 8)}</code><time dateTime={row.finalized_at}>{formatDate(snapshot.finalized_at.slice(0, 10))} sealed</time></div>
        <h3>{headline}</h3>
        {snapshot.outcome === 'win' ? <p>{(snapshot.margin_bp / 100).toFixed(2)} point margin · {winner?.display_name} takes the laurel.</p> : <p>{snapshot.outcome === 'tie' ? 'A shared laurel. Diplomacy, somehow.' : 'The ledger rests; the next week starts fresh.'}</p>}
        <div className="commit-scores">{snapshot.players.map((player) => <span className={player.display_name === 'Catalina' ? 'score-catalina' : 'score-cristian'} key={player.user_id}><i aria-hidden="true"/>{player.display_name}<strong className="score">{(player.score_bp / 100).toFixed(2)}</strong></span>)}</div>
      </div>
    </article>;
  })}</div>;
}

export function HomePage() {
  const { user } = useAuth(); const queryClient = useQueryClient(); const bootstrap = useBootstrap();
  const [date, setDate] = useState(bucharestDate()); const [kg, setKg] = useState('');
  const results = useQuery({ queryKey: ['results', user?.id], queryFn: async () => { const { data, error } = await requireSupabase().from('weekly_results').select('*').order('finalized_at', { ascending: false }); if (error) throw error; return (data ?? []).map((row) => ({ ...row, snapshot: row.snapshot as unknown as ResultSnapshot })) as ResultRow[]; }, enabled: Boolean(user) });
  const sharedStats = useQuery({ queryKey: ['shared-stats', user?.id], queryFn: api.getSharedStats, enabled: Boolean(user) });
  const ownWeights = useQuery({ queryKey: ['own-weight-versions', user?.id], queryFn: async () => { const { data, error } = await requireSupabase().from('weight_entries').select('*').eq('user_id', user!.id).order('measured_on'); if (error) throw error; return data as WeightEntry[]; }, enabled: Boolean(user) });
  const saveWeight = useMutation({ mutationFn: async () => { const existing = ownWeights.data?.find((entry) => entry.measured_on === date); return api.saveWeight(date, Number(kg), existing?.version ?? 0); }, onSuccess: () => { setKg(''); notify('Weight observation shared with the club.', 'success'); queryClient.invalidateQueries({ queryKey: ['own-weight-versions', user?.id] }); queryClient.invalidateQueries({ queryKey: ['shared-stats', user?.id] }); } });
  async function exportData() {
    try {
      const [logs, weightEntries, plans, sharedResults] = await Promise.all([
        fetchAll('daily_logs', user!.id), fetchAll('weight_entries', user!.id), fetchAll('weekly_plans', user!.id), fetchAll('weekly_results', user!.id),
      ]);
      const payload = { export_schema_version: 1, exported_at: new Date().toISOString(), timezone: 'Europe/Bucharest', user_id: user!.id, daily_logs: logs, weight_entries: weightEntries, plans, shared_results: sharedResults };
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `3digit-club-export-${bucharestDate()}.json`; link.click(); URL.revokeObjectURL(url); notify('Your personal JSON export is ready.', 'success');
    } catch { notify('Your export could not be created. Your records are unchanged.'); }
  }
  function submitWeight(event: FormEvent) {
    event.preventDefault();
    const validation = weightEntrySchema.safeParse({ measured_on: date, kg: Number(kg) });
    if (!validation.success) { notify(validationMessage(validation.error)); return; }
    if (date > bucharestDate()) { notify('Choose today or an earlier date for a measurement.'); return; }
    saveWeight.mutate();
  }

  const clubPlayers = sharedStats.data?.players ?? [];
  return <main className="page home-page">
    <header className="home-hero"><div><p className="eyebrow">The club record · Catalina &amp; Cristian</p><h1 className="display">A history of <em>showing up.</em></h1><p>Wins are written in ink. The rest is still progress.</p></div><div className="home-seal" aria-hidden="true"><span>3</span><i>DC</i></div></header>

    <section className="card wall-card" aria-labelledby="wall-title"><div className="home-section-heading"><div><p className="eyebrow">The commit wall</p><h2 className="display" id="wall-title">Weeks, won and witnessed.</h2></div><span className="wall-legend"><i className="legend-catalina"/>Catalina <i className="legend-cristian"/>Cristian</span></div><CommitWall rows={results.data ?? []} loading={results.isLoading} error={results.error} /></section>

    <section className="card home-weight-card" aria-labelledby="weight-title"><div className="home-section-heading weight-heading"><div><p className="eyebrow"><Scale size={14}/> Shared club stats</p><h2 className="display" id="weight-title">Weight, over time.</h2><p className="weight-caption">Both members can see the club's weight trends.</p></div></div>
      {sharedStats.isLoading ? <Loading label="Loading shared club stats..."/> : sharedStats.error ? <p className="error" role="alert">Shared stats could not be loaded. {sharedStats.error.message}</p> : <div className="shared-weight-grid">{clubPlayers.map((player) => <WeightMemberCard key={player.user_id} name={player.display_name} entries={player.weights} isOwn={player.user_id === user?.id}/>)}</div>}
      <form className="home-weight-form" onSubmit={submitWeight} noValidate><div className="field"><label htmlFor="home-weight-date">Date</label><input id="home-weight-date" className="input" type="date" max={bucharestDate()} value={date} onChange={(event) => setDate(event.target.value)}/></div><div className="field"><label htmlFor="home-weight-kg">Add your weight (kg)</label><input id="home-weight-kg" className="input" type="number" min="0.01" max="999.99" step="0.01" required value={kg} onChange={(event) => setKg(event.target.value)} placeholder="e.g. 72.40"/></div><button className="button" disabled={saveWeight.isPending || ownWeights.isLoading}>{saveWeight.isPending ? 'Saving...' : 'Add observation'}</button><button className="button ghost export-button" type="button" onClick={exportData}><Download size={16}/> Export my data</button></form>
      {saveWeight.error && <p className="error" role="alert">{saveWeight.error.message} Your entry was not saved.</p>}
      <p className="privacy-note">Weight trends, daily calorie totals, and activity stats are shared between Catalina and Cristian. Personal notes stay visible only to the person who wrote them. Your JSON export contains your own records.</p>
    </section>

    <footer className="home-footer">A good record is built one ordinary week at a time. <span>{bootstrap.data ? `Server checked ${new Date(bootstrap.data.server_now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : ''}</span></footer>
  </main>;
}
