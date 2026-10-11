import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router';
import type { UseQueryResult } from '@tanstack/react-query';
import { CheckCircle2, LockKeyhole, Flame } from 'lucide-react';
import { useAuth } from '../../app/providers';
import { useWeekSummary } from '../../app/useClubData';
import { Loading } from '../../components/Loading';
import { api } from '../../lib/api';
import { formatInstant, formatWeek } from '../../lib/dates';
import type { DuelBootstrap, SharedDailyStat, WeekPlan } from '../../lib/types';
import { WeeklyStats } from './WeeklyStats';
import { weekPlanSchema, validationMessage } from '../../lib/validation';
import { notify } from '../../lib/notifications';
import './pact.css';

function PlanCard({ plan, own, editable, locked, revision, weekId }: { plan: WeekPlan; own: boolean; editable: boolean; locked: boolean; revision: number; weekId: string }) {
  const queryClient = useQueryClient(); const [draft, setDraft] = useState(plan); const [editing, setEditing] = useState(own && !locked);
  useEffect(() => { setDraft(plan); setEditing(own && !locked); }, [plan, own, locked, revision]);
  const mutation = useMutation({ mutationFn: () => api.saveWeekPlan(weekId, revision, {
    training_target: draft.training_target, training_description: draft.training_description,
    nutrition_mode: draft.nutrition_mode, nutrition_target_days: draft.nutrition_target_days,
    nutrition_description: draft.nutrition_description, calorie_min: draft.calorie_min,
    calorie_max: draft.calorie_max, walking_minutes_target: draft.walking_minutes_target,
    walking_target_days: draft.walking_target_days, recovery_target_days: draft.recovery_target_days,
    recovery_description: draft.recovery_description,
    weekly_kcal_budget: draft.weekly_kcal_budget,
  }), onSuccess: () => { notify('Your plan was saved. Both approvals have been reset for the new revision.', 'success'); queryClient.invalidateQueries({ queryKey: ['week-summary'] }); } });
  function submit(event: FormEvent) {
    event.preventDefault();
    const values = { training_target: draft.training_target, training_description: draft.training_description, nutrition_mode: draft.nutrition_mode, nutrition_target_days: draft.nutrition_target_days, nutrition_description: draft.nutrition_description, calorie_min: draft.calorie_min, calorie_max: draft.calorie_max, walking_minutes_target: draft.walking_minutes_target, walking_target_days: draft.walking_target_days, recovery_target_days: draft.recovery_target_days, recovery_description: draft.recovery_description, weekly_kcal_budget: draft.weekly_kcal_budget };
    const validation = weekPlanSchema.safeParse(values);
    if (!validation.success) { notify(validationMessage(validation.error)); return; }
    mutation.mutate();
  }
  return <form className={`card plan-card ${own ? 'own-plan' : ''}`} onSubmit={submit} noValidate>
    <div className="plan-person"><span>{plan.display_name === 'Catalina' ? 'CA' : 'CR'}</span><div><p className="eyebrow">{own ? 'Your commitments' : 'Fellow member'}</p><h2 className="display">{plan.display_name}</h2></div></div>
    <fieldset disabled={!own || !editable || !editing || mutation.isPending}>
      <legend className="sr-only">{plan.display_name}'s plan</legend>
      <div className="plan-section"><div className="plan-number">01</div><div><label>Training days <input type="number" min="1" max="5" value={draft.training_target} onChange={(e) => setDraft({ ...draft, training_target: Number(e.target.value) })} /></label><textarea maxLength={160} value={draft.training_description} onChange={(e) => setDraft({ ...draft, training_description: e.target.value })} /></div></div>
      <div className="plan-section"><div className="plan-number">02</div><div><label>Nutrition days <input type="number" min="1" max="7" value={draft.nutrition_target_days} onChange={(e) => setDraft({ ...draft, nutrition_target_days: Number(e.target.value) })} /></label><select value={draft.nutrition_mode} onChange={(e) => setDraft({ ...draft, nutrition_mode: e.target.value as WeekPlan['nutrition_mode'], calorie_min: null, calorie_max: null })}><option value="habit">Personal habit</option><option value="calorie_band">Existing calorie range</option></select><textarea maxLength={160} value={draft.nutrition_description} onChange={(e) => setDraft({ ...draft, nutrition_description: e.target.value })} />{draft.nutrition_mode === 'calorie_band' && <div className="range-inputs"><input aria-label="Minimum kcal" type="number" value={draft.calorie_min ?? ''} onChange={(e) => setDraft({ ...draft, calorie_min: Number(e.target.value) })} /><span>to</span><input aria-label="Maximum kcal" type="number" value={draft.calorie_max ?? ''} onChange={(e) => setDraft({ ...draft, calorie_max: Number(e.target.value) })} /></div>}</div></div>
      <div className="plan-section"><div className="plan-number">03</div><div><label>Walking <input type="number" min="5" max="120" value={draft.walking_minutes_target} onChange={(e) => setDraft({ ...draft, walking_minutes_target: Number(e.target.value) })} /> min on <input type="number" min="1" max="7" value={draft.walking_target_days} onChange={(e) => setDraft({ ...draft, walking_target_days: Number(e.target.value) })} /> days</label></div></div>
      <div className="plan-section"><div className="plan-number">04</div><div><label>Recovery days <input type="number" min="1" max="7" value={draft.recovery_target_days} onChange={(e) => setDraft({ ...draft, recovery_target_days: Number(e.target.value) })} /></label><textarea maxLength={160} value={draft.recovery_description} onChange={(e) => setDraft({ ...draft, recovery_description: e.target.value })} /></div></div>
      <div className="plan-section kcal-plan-section"><div className="plan-number"><Flame size={16}/></div><div><label htmlFor={`weekly-kcal-${plan.user_id}`}>Optional weekly kcal budget</label><div className="weekly-budget-input"><input id={`weekly-kcal-${plan.user_id}`} type="number" min="1" max="140000" step="1" placeholder="Not set" value={draft.weekly_kcal_budget ?? ''} onChange={(e) => setDraft({ ...draft, weekly_kcal_budget: e.target.value === '' ? null : Number(e.target.value) })}/><span>kcal / week</span><button type="button" className="clear-budget" onClick={() => setDraft({ ...draft, weekly_kcal_budget: null })}>Clear</button></div><small className="plan-help">Self-selected tracking limit. It does not affect points or recommend an intake.</small></div></div>
    </fieldset>
    {own && editable && locked && !editing && <button type="button" className="button secondary revise-plan-button" onClick={() => setEditing(true)}>Revise my plan</button>}
    {own && editable && editing && <button className="button secondary" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Save my plan'}</button>}
    {mutation.error && <p role="alert" className="error">{mutation.error.message}</p>}
  </form>;
}

function WeeklyKcalCard({ weekId, weekStart, plan, rows, loading, error }: { weekId: string; weekStart: string; plan: WeekPlan; rows: SharedDailyStat[]; loading: boolean; error: Error | null }) {
  const playerName = plan.display_name; const budget = plan.weekly_kcal_budget;
  const weekRows = rows.filter((row) => row.week_id === weekId);
  const total = weekRows.reduce((sum, row) => sum + (row.actual_kcal ?? 0), 0);
  const remaining = budget === null ? null : budget - total;
  const maxDay = Math.max(1, ...weekRows.map((row) => row.actual_kcal ?? 0));
  const maxWalk = Math.max(1, ...weekRows.map((row) => row.walking_minutes ?? 0));
  const dates = Array.from({ length: 7 }, (_, index) => { const date = new Date(`${weekStart}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + index); return date.toISOString().slice(0, 10); });
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return <section className="card weekly-kcal-card"><div className="kcal-card-heading"><div><p className="eyebrow"><Flame size={14}/> Shared daily stats · {playerName}</p><h2 className="display">Calories &amp; activity</h2></div><span className={`kcal-status ${remaining === null ? 'no-budget' : remaining < 0 ? 'over' : 'within'}`}>{remaining === null ? 'No budget set' : remaining < 0 ? 'Over budget' : 'Within budget'}</span></div>
    {loading ? <Loading label="Adding up club calorie entries..."/> : error ? <p className="error">Shared activity stats could not be loaded.</p> : <>
      <div className="kcal-remaining"><div><strong className="display score">{remaining === null ? total.toLocaleString() : Math.abs(remaining).toLocaleString()}</strong><span>{remaining === null ? 'kcal logged' : remaining < 0 ? 'kcal over' : 'kcal remaining'}</span></div><div className="kcal-fraction"><span className="score">{total.toLocaleString()}{budget === null ? '' : ` / ${budget.toLocaleString()}`}</span><small>{budget === null ? 'total calories logged' : 'logged / weekly budget'}</small></div></div>
      {budget !== null && <div className="kcal-meter" role="progressbar" aria-label={`${playerName} weekly calorie budget used`} aria-valuemin={0} aria-valuemax={budget} aria-valuenow={total}><i className={remaining! < 0 ? 'over' : 'within'} style={{ width: `${Math.min(100, total / budget * 100)}%` }}/></div>}
      <div className="kcal-chart-label">Calories by day <span>kcal</span></div><div className="kcal-bars" aria-label={`${playerName} calories logged per day`}>{dates.map((date, index) => { const row = weekRows.find((item) => item.log_date === date); const amount = row?.actual_kcal ?? null; const barTone = remaining === null ? 'neutral' : remaining < 0 ? 'over' : 'within'; return <div className="kcal-bar-day" key={date} title={`${date}: ${amount === null ? 'no entry' : `${amount} kcal`}`}><div className="kcal-bar-track"><i className={barTone} style={{ height: amount === null ? '0%' : `${Math.max(4, amount / maxDay * 100)}%` }}/></div><strong>{days[index]}</strong><small>{amount === null ? '—' : amount.toLocaleString()}</small></div>; })}</div>
      <div className="kcal-chart-label">Walking by day <span>minutes</span></div><div className="kcal-bars walking-bars" aria-label={`${playerName} walking minutes by day`}>{dates.map((date, index) => { const row = weekRows.find((item) => item.log_date === date); const amount = row?.walking_minutes ?? null; return <div className="kcal-bar-day" key={date} title={`${date}: ${amount === null ? 'no entry' : `${amount} minutes`}`}><div className="kcal-bar-track"><i className="walk" style={{ height: amount === null ? '0%' : `${Math.max(4, amount / maxWalk * 100)}%` }}/></div><strong>{days[index]}</strong><small>{amount === null ? '—' : amount}</small></div>; })}</div>
      <div className="daily-check-legend"><span><i className="done"/> Completed</span><span><i/> Not logged / not completed</span><span>{plan.nutrition_mode === 'habit' ? 'Nutrition habit' : 'Agreed calorie band'}</span></div>
      <div className="daily-check-grid">{dates.map((date, index) => { const row=weekRows.find((item)=>item.log_date===date); const nutrition=row ? plan.nutrition_mode==='habit' ? row.nutrition_habit_done : row.actual_kcal!==null && plan.calorie_min!==null && plan.calorie_max!==null && row.actual_kcal>=plan.calorie_min && row.actual_kcal<=plan.calorie_max : false; const marks=[row?.training_done??false,nutrition,(row?.walking_minutes??0)>=plan.walking_minutes_target,row?.recovery_done??false]; return <div className="daily-check-day" key={date}><small>{days[index]}</small><div>{marks.map((done,markIndex)=><i className={done?'done':''} key={markIndex} title={['Training','Nutrition','Walking','Recovery'][markIndex]}/>)}</div></div>; })}</div>
      <p className="kcal-note">Daily calories, walking minutes, and completion flags are shared with both members. A budget is optional and never affects competition points.</p>
    </>}
  </section>;
}

export function PactPage() {
  const { bootstrap } = useOutletContext<{ bootstrap: UseQueryResult<DuelBootstrap> }>(); const { user } = useAuth(); const queryClient = useQueryClient();
  const summary = useWeekSummary(bootstrap.data?.next_week_id ?? bootstrap.data?.current_week_id);
  const sharedStats = useQuery({ queryKey: ['shared-stats', user?.id], queryFn: api.getSharedStats, enabled: Boolean(user) });
  const approve = useMutation({ mutationFn: () => api.approveWeek(summary.data!.week_id, summary.data!.revision), onSuccess: (result) => { notify(result.locked_at ? 'Both members approved this revision. The week is ranked again.' : 'Your approval is recorded; waiting for the other member.', 'success'); queryClient.invalidateQueries({ queryKey: ['week-summary'] }); } });
  if (summary.isLoading) return <main className="page"><Loading /></main>;
  if (!summary.data) return <main className="page"><p className="error">{summary.error?.message ?? 'No pact is available.'}</p></main>;
  const week = summary.data; const serverNow = Date.parse(week.server_now); const editable = (week.state === 'draft' && serverNow < Date.parse(week.approval_deadline)) || (week.state === 'active' && serverNow < Date.parse(week.ends_at)); const locked = week.state === 'active' && week.locked_at !== null; const ownApproval = week.approvals.some((item) => item.user_id === user?.id && item.approved_revision === week.revision);
  return <main className="page pact-page"><header className="section-hero"><p className="eyebrow">Week plan · {formatWeek(week.week_start)}</p><h1 className="display">This week, <em>by design.</em></h1><p>Set your own weekly commitments, review both plans, and approve the same revision before the week becomes competitive.</p></header>
    <div className="revision-bar"><div><span>Revision</span><strong className="display">{week.revision}</strong></div><p>{locked ? <><LockKeyhole size={16} /> Approved by both. Revisions are open until the activity week ends.</> : week.state === 'active' ? <>This revision needs both approvals to keep ranked scoring. Approval closes at the activity-week boundary.</> : <>Both members approve the complete pair before {formatInstant(week.approval_deadline)}.</>}</p></div>
    <div className="plan-grid">{week.plans.map((plan) => <PlanCard key={plan.user_id} plan={plan} own={plan.user_id === user?.id} editable={editable} locked={locked} revision={week.revision} weekId={week.week_id} />)}</div>
    {week.plans.map((plan) => <WeeklyKcalCard key={plan.user_id} weekId={week.week_id} weekStart={week.week_start} plan={plan} rows={sharedStats.data?.players.find((player) => player.user_id === plan.user_id)?.daily ?? []} loading={sharedStats.isLoading} error={sharedStats.error}/>) }
    {week.ranked && week.stage !== 'scheduled' && <WeeklyStats players={week.players}/>}
    <section className="card approval-card"><div><p className="eyebrow">Mutual agreement</p><h2 className="display">{locked ? 'Both members approved.' : ownApproval ? 'Your approval is recorded.' : week.state === 'active' ? 'Approve the revised goals?' : 'Ready to give your word?'}</h2><p>{locked ? 'You can revise your goals while the activity week is open; any revision asks both members to approve again.' : week.state === 'active' ? 'The updated goals apply to the whole week after both members approve this revision.' : `Reward: ${week.reward_text}`}</p></div>{locked ? <CheckCircle2 size={42} /> : <button className="button" disabled={ownApproval || approve.isPending || !editable} onClick={() => approve.mutate()}>{ownApproval ? 'Waiting for the other signature' : approve.isPending ? 'Signing...' : `Approve revision ${week.revision}`}</button>}{approve.error && <p className="error">{approve.error.message}</p>}</section>
  </main>;
}
