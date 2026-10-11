import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { errorMessage, notify } from '../lib/notifications';
import { ToastProvider } from '../components/ToastProvider';

const queryClient = new QueryClient({ queryCache: new QueryCache({ onError: (error) => notify(errorMessage(error)) }), mutationCache: new MutationCache({ onError: (error) => notify(errorMessage(error)) }), defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true, refetchInterval: 30_000, refetchIntervalInBackground: false }, mutations: { retry: false } } });

type AuthValue = { session: Session | null; user: User | null; loading: boolean };
const AuthContext = createContext<AuthValue>({ session: null, user: null, loading: true });
// This module intentionally exports the auth hook beside its provider.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ session, user: session?.user ?? null, loading }}>{children}</AuthContext.Provider>;
}

export function AppProviders({ children }: PropsWithChildren) {
  return <QueryClientProvider client={queryClient}><AuthProvider><ToastProvider>{children}</ToastProvider></AuthProvider></QueryClientProvider>;
}
