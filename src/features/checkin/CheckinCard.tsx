import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useAuth } from '../../app/providers';
import { api } from '../../lib/api';
import { requireSupabase } from '../../lib/supabase';
import type { DuelBootstrap, WeekPlan } from '../../lib/types';
import './checkin.css';
import { dailyLogSchema, validationMessage } from '../../lib/validation';
import { notify } from '../../lib/notifications';

function KcalBudgetHint({ budget, weekId, userId, date, value }: { budget: number; weekId?: string; userId: string; date: string; value: string }) {
  const summary = useQuery({ queryKey: ['weekly-kcal', userId, weekId], enabled: Boolean(weekId), queryFn: async () => {
    const { data, error } = await requireSupabase().from('daily_logs').select('log_date,actual_kcal').eq('user_id', userId).eq('week_id', weekId!);
    if (error) throw error;
    return data;
  } });
  const otherDays = (summary.data ?? []).filter((row) => row.log_date !== date).reduce((sum, row) => sum + (row.actual_kcal ?? 0), 0);
  const remaining = budget - otherDays - (value === '' ? 0 : Number(value));
  return <p className={`daily-kcal-remaining ${remaining < 0 ? 'over' : 'within'}`} aria-live="polite">{summary.isLoading ? 'Updating weekly balance...' : remaining < 0 ? `${Math.abs(remaining).toLocaleString()} kcal over your weekly budget` : `${remaining.toLocaleString()} kcal left in your weekly budget`}</p>;
}

export function CheckinCard({ bootstrap, plan }: { bootstrap: DuelBootstrap; plan: WeekPlan }) {
  const { user } = useAuth(); const queryClient = useQueryClient();
  const dates = bootstrap.editable_dates;
  const [date, setDate] = useState(dates.at(-1)?.date ?? '');
  const mapping = dates.find((item) => item.date === date);
  const query = useQuery({ queryKey: ['daily-log', user?.id, mapping?.week_id, date], enabled: Boolean(mapping), queryFn: async () => { const { data, error } = await requireSupabase().from('daily_logs').select('*').eq('week_id', mapping!.week_id).eq('log_date', date).maybeSingle(); if (error) throw error; return data; } });
  const [training, setTraining] = useState(false); const [nutrition, setNutrition] = useState(false); const [kcal, setKcal] = useState(''); const [walking, setWalking] = useState(''); const [recovery, setRecovery] = useState(false); const [note, setNote] = useState('');
  useEffect(() => { const row = query.data; setTraining(row?.training_done ?? false); setNutrition(row?.nutrition_habit_done ?? false); setKcal(row?.actual_kcal?.toString() ?? ''); setWalking(row?.walking_minutes?.toString() ?? ''); setRecovery(row?.recovery_done ?? false); setNote(row?.private_note ?? ''); }, [query.data]);
  const mutation = useMutation({ mutationFn: () => api.saveDailyLog(mapping!.week_id, date, query.data?.version ?? 0, crypto.randomUUID(), { training_done: training, nutrition_habit_done: nutrition, actual_kcal: kcal === '' ? null : Number(kcal), walking_minutes: walking === '' ? null : Number(walking), recovery_done: recovery, private_note: note.trim() || null }), onSuccess: () => { notify('Your check-in is saved.', 'success'); queryClient.invalidateQueries({ queryKey: ['daily-log'] }); queryClient.invalidateQueries({ queryKey: ['weekly-kcal'] }); queryClient.invalidateQueries({ queryKey: ['shared-stats'] }); queryClient.invalidateQueries({ queryKey: ['week-summary'] }); } });
  function submit(event: FormEvent) {
    event.preventDefault();
    const values = { training_done: training, nutrition_habit_done: nutrition, actual_kcal: kcal === '' ? null : Number(kcal), walking_minutes: walking === '' ? null : Number(walking), recovery_done: recovery, private_note: note.trim() || null };
    const validation = dailyLogSchema.safeParse(values);
    if (!validation.success) { notify(validationMessage(validation.error)); return; }
    mutation.mutate();
  }
  return <section className="card checkin-card" id="checkin"><div className="card-heading"><div><p className="eyebrow">The ledger</p><h2 className="display">Log your day</h2></div>{dates.length > 1 && <select aria-label="Log date" className="date-select" value={date} onChange={(e) => setDate(e.target.value)}>{dates.map((item) => <option key={item.date} value={item.date}>{item.date}</option>)}</select>}</div>
    <form onSubmit={submit} noValidate>
      <label className="check-row"><input type="checkbox" checked={training} onChange={(e) => setTraining(e.target.checked)} /><span><strong>Training</strong><small>{plan.training_description}</small></span><Check size={18} /></label>
      {plan.nutrition_mode === 'habit' ? <><label className="check-row"><input type="checkbox" checked={nutrition} onChange={(e) => setNutrition(e.target.checked)} /><span><strong>Nutrition</strong><small>{plan.nutrition_description}</small></span><Check size={18} /></label>{plan.weekly_kcal_budget !== null && <><div className="number-row"><label htmlFor="kcal"><strong>Calories today <span className="muted">(optional)</span></strong><small>For your private weekly budget tracker</small></label><input id="kcal" className="input" type="number" min="0" max="20000" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="kcal" /></div>{mapping && user && <KcalBudgetHint budget={plan.weekly_kcal_budget} weekId={mapping.week_id} userId={user.id} date={date} value={kcal}/>}</>}</> : <><div className="number-row"><label htmlFor="kcal"><strong>Nutrition</strong><small>{plan.calorie_min}-{plan.calorie_max} kcal agreed range</small></label><input id="kcal" className="input" type="number" min="0" max="20000" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="kcal" /></div>{plan.weekly_kcal_budget !== null && mapping && user && <KcalBudgetHint budget={plan.weekly_kcal_budget} weekId={mapping.week_id} userId={user.id} date={date} value={kcal}/>}</>}
      <div className="number-row"><label htmlFor="walking"><strong>Walking</strong><small>{plan.walking_minutes_target} minutes qualifies today</small></label><input id="walking" className="input" type="number" min="0" max="1440" value={walking} onChange={(e) => setWalking(e.target.value)} placeholder="min" /></div>
      <label className="check-row"><input type="checkbox" checked={recovery} onChange={(e) => setRecovery(e.target.checked)} /><span><strong>Recovery</strong><small>{plan.recovery_description}</small></span><Check size={18} /></label>
      <div className="field note-field"><label htmlFor="note">Private note <span>Only you can read this</span></label><textarea id="note" className="input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></div>
      {mutation.error && <p className="error" role="alert">{mutation.error.message} Not saved - try again.</p>}
      <button className="button save-button" disabled={!mapping || mutation.isPending}>{mutation.isPending ? 'Saving...' : mutation.isSuccess ? 'Saved to the ledger' : 'Save check-in'}</button>
    </form>
  </section>;
}
