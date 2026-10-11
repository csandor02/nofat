import { Link, useOutletContext } from 'react-router';
import type { UseQueryResult } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { Loading } from '../../components/Loading';
import { formatWeek } from '../../lib/dates';
import type { DuelBootstrap } from '../../lib/types';
import { useAuth } from '../../app/providers';
import { useWeekSummary } from '../../app/useClubData';
import { DuelCard } from '../duel/DuelCard';
import { CheckinCard } from '../checkin/CheckinCard';
import { selectMeme } from '../../content/memes';
import './today.css';

export function TodayPage() {
  const { bootstrap } = useOutletContext<{ bootstrap: UseQueryResult<DuelBootstrap> }>(); const { user } = useAuth();
  const summary = useWeekSummary(bootstrap.data?.current_week_id);
  if (bootstrap.isLoading || summary.isLoading) return <main className="page"><Loading /></main>;
  if (bootstrap.error || summary.error || !summary.data) return <main className="page"><div className="card error-panel"><p className="eyebrow">Ledger unavailable</p><h1 className="display">The club cannot reach its records.</h1><p>{bootstrap.error?.message ?? summary.error?.message ?? 'Try again shortly.'}</p><button className="button secondary" onClick={() => { bootstrap.refetch(); summary.refetch(); }}>Retry</button></div></main>;
  const week = summary.data; const ownPlan = week.plans.find((plan) => plan.user_id === user?.id) ?? week.plans[0]; const meme = selectMeme(`${week.week_id}${user?.id}welcome${week.week_start}`, 'welcome', 'locker_room');
  return <main className="page today-page">
    <header className="today-hero"><div><p className="eyebrow">Week of {formatWeek(week.week_start)}</p><h1 className="display">The weekly <em>account.</em></h1><p>{week.stage === 'planning' ? 'The pact awaits both signatures.' : week.stage === 'corrections' ? 'The activity window is closed. Sunday corrections remain open.' : 'Small promises, kept with excellent form.'}</p></div><div className="week-stamp"><span>Week</span><strong className="display">{new Date(`${week.week_start}T00:00:00Z`).getUTCDate()}</strong><i>{week.state}</i></div></header>
    <div className="dashboard-grid"><div className="main-column"><DuelCard players={week.players} ranked={week.ranked} /><a className="mobile-log button" href="#checkin">Log today</a><CheckinCard bootstrap={bootstrap.data!} plan={ownPlan} /></div>
      <aside className="side-column"><section className="card pact-summary"><p className="eyebrow">This week's plan</p><h2 className="display">Revision {week.revision}</h2><div className="pact-state"><span className="seal" aria-hidden="true">{week.locked_at ? '✓' : '2'}</span><div><strong>{week.locked_at ? 'Approved by both members' : `${week.approvals.length} of 2 approvals`}</strong><small>{week.locked_at ? 'Revisions can be proposed while the week is open.' : 'Both members approve the current revision.'}</small></div></div><hr className="rule" /><ul><li><span>Training</span><strong>{ownPlan.training_target} days</strong></li><li><span>Nutrition</span><strong>{ownPlan.nutrition_target_days} days</strong></li><li><span>Walking</span><strong>{ownPlan.walking_target_days} days</strong></li><li><span>Recovery</span><strong>{ownPlan.recovery_target_days} days</strong></li></ul><Link to="/week">Review this week's goals <ArrowRight size={15} /></Link></section>
      <section className="meme-card"><div className="meme-lines" aria-hidden="true"><i/><i/><i/></div><p className="eyebrow">From the locker room</p><blockquote className="display">“{meme.text}”</blockquote><span>3DIGIT CLUB BULLETIN · {week.week_start}</span></section>
      <a className="inspiration" href="https://davidgoggins.com/" target="_blank" rel="noreferrer"><span>Optional inspiration</span><strong>David Goggins · Official site</strong></a></aside>
    </div>
  </main>;
}
