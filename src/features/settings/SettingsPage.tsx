import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useOutletContext } from 'react-router';
import type { UseQueryResult } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../app/providers';
import { requireSupabase } from '../../lib/supabase';
import type { DuelBootstrap } from '../../lib/types';
import './settings.css';
import { notify } from '../../lib/notifications';

export function SettingsPage() {
  const navigate = useNavigate(); const queryClient = useQueryClient(); const { bootstrap } = useOutletContext<{ bootstrap: UseQueryResult<DuelBootstrap> }>();
  const { user } = useAuth();
  const member = useQuery({ queryKey: ['member', user?.id], queryFn: async () => { const { data, error } = await requireSupabase().from('members').select('*').eq('user_id', user!.id).single(); if (error) throw error; return data; }, enabled: Boolean(user) });
  const [password, setPassword] = useState('');
  const preferences = useMutation({ mutationFn: ({ humor, sound }: { humor: string; sound: boolean }) => api.savePreferences(humor, sound), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['member'] }) });
  const pause = useMutation({ mutationFn: () => api.pauseWeek(bootstrap.data!.current_week_id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['week-summary'] }) });
  async function signOut() { const { error } = await requireSupabase().auth.signOut(); if (error) { notify('Could not sign out. Please try again.'); return; } queryClient.clear(); navigate('/login'); }
  async function changePassword() {
    if (!/^\d{4}$/.test(password)) { notify('Enter a new four-digit club code.'); return; }
    const { error } = await requireSupabase().auth.updateUser({ password: `3digit-${password}` });
    if (error) { notify('The club code could not be changed. Please try again.'); return; }
    setPassword(''); notify('Your club code has been updated.', 'success');
  }
  return <main className="page settings-page"><header className="section-hero"><p className="eyebrow">Club administration</p><h1 className="display">Settings, <em>sensibly kept.</em></h1></header>
    <section className="card settings-section"><div><h2 className="display">Club personality</h2><p>Quiet mode is restrained. Locker Room mode permits more absurdity.</p></div><div className="setting-controls"><label>Humor<select className="input" value={member.data?.humor_mode ?? 'locker_room'} onChange={(e) => preferences.mutate({ humor: e.target.value, sound: member.data?.sound_enabled ?? false })}><option value="quiet">Quiet</option><option value="locker_room">Locker Room</option></select></label><label className="toggle"><input type="checkbox" checked={member.data?.sound_enabled ?? false} onChange={(e) => preferences.mutate({ humor: member.data?.humor_mode ?? 'locker_room', sound: e.target.checked })}/><span>Sound enabled</span></label></div></section>
    <section className="card settings-section"><div><h2 className="display">Club code</h2><p>Choose a new four-digit code for your member login.</p></div><div className="setting-controls"><input className="input" type="password" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New four-digit code"/><button className="button secondary" onClick={changePassword}>Change code</button></div></section>
    <section className="card settings-section recovery-setting"><div><h2 className="display">Recovery pause</h2><p>Pause the active duel without penalty. Existing logs remain available. This cannot be undone after the activity window closes.</p></div><button className="button secondary" disabled={pause.isPending} onClick={() => window.confirm('Pause this week for both members?') && pause.mutate()}>Pause current week</button></section>
    <button className="button ghost signout" onClick={signOut}>Sign out of 3DIGIT CLUB</button>
  </main>;
}
