import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { BrandMark } from '../../components/BrandMark';
import { configurationError, supabase } from '../../lib/supabase';
import { useAuth } from '../../app/providers';
import { notify } from '../../lib/notifications';
import { loginSchema, validationMessage } from '../../lib/validation';
import './login.css';

export function LoginPage() {
  const { session } = useAuth();
  const [member, setMember] = useState<'catalina' | 'cristian'>('catalina');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(configurationError);
  const [submitting, setSubmitting] = useState(false);
  if (session) return <Navigate to="/home" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null);
    const validation = loginSchema.safeParse({ member, code });
    if (!validation.success) { const message = validationMessage(validation.error); setError(message); notify(message); return; }
    setSubmitting(true);
    const email = `${member}@3digit.club`;
    const { error: authError } = await supabase!.auth.signInWithPassword({ email, password: `3digit-${code}` });
    if (authError) { setError('The member name or club code was not recognised.'); notify('The member name or club code was not recognised.'); }
    setSubmitting(false);
  }

  return <main className="login-page">
    <section className="login-intro">
      <BrandMark />
      <p className="eyebrow">Private members' ledger</p>
      <h1 className="display">Keep your promises.<br/><em>Elegantly.</em></h1>
      <p>Two members. Four commitments. One weekly account of who actually did the thing.</p>
      <div className="login-quote"><span aria-hidden="true">03</span><blockquote>“Excellent manners.<br/>Questionable gym memes.”</blockquote></div>
    </section>
    <section className="login-panel">
      <div className="login-form-wrap">
        <p className="eyebrow">Club entrance</p>
        <h2 className="display">Welcome back</h2>
        <p className="muted">Sign in with your private member account.</p>
        <form onSubmit={submit} className="login-form" noValidate>
          <div className="field"><label htmlFor="member">Member</label><select className="input" id="member" value={member} onChange={(event) => setMember(event.target.value as 'catalina' | 'cristian')}><option value="catalina">Catalina</option><option value="cristian">Cristian</option></select></div>
          <div className="field"><label htmlFor="club-code">Club code</label><input className="input" id="club-code" type="password" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} autoComplete="current-password" required value={code} onChange={(event) => setCode(event.target.value)} /></div>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="button" disabled={submitting || Boolean(configurationError)}>{submitting ? 'Opening...' : 'Enter the club'}</button>
        </form>
        <p className="login-private">Membership is limited to Catalina and Cristian. There is no public registration.</p>
      </div>
    </section>
  </main>;
}
