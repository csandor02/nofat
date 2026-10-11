import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { AppLayout } from './AppLayout';
import { useAuth } from './providers';
import { Loading } from '../components/Loading';
import { LoginPage } from '../features/auth/LoginPage';
import { TodayPage } from '../features/today/TodayPage';
import { PactPage } from '../features/pact/PactPage';
import { CabinetPage } from '../features/cabinet/CabinetPage';
import { SettingsPage } from '../features/settings/SettingsPage';

const CeremonyPage = lazy(() => import('../features/ceremony/CeremonyPage').then((module) => ({ default: module.CeremonyPage })));
const HomePage = lazy(() => import('../features/home/HomePage').then((module) => ({ default: module.HomePage })));

function Protected() {
  const { session, loading } = useAuth(); const location = useLocation();
  if (loading) return <main className="page"><Loading /></main>;
  return session ? <AppLayout /> : <Navigate to="/login" state={{ from: location }} replace />;
}

export function AppRouter() {
  return <HashRouter><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<Protected />}>
      <Route path="/home" element={<Suspense fallback={<main className="page"><Loading /></main>}><HomePage /></Suspense>} />
      <Route path="/today" element={<TodayPage />} />
      <Route path="/week" element={<PactPage />} />
      <Route path="/pact" element={<Navigate to="/week" replace />} />
      <Route path="/cabinet" element={<CabinetPage />} />
      <Route path="/journal" element={<Navigate to="/home" replace />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Route>
    <Route path="/ceremony/:weekId" element={<Protected />}><Route index element={<Suspense fallback={<main className="ceremony-page"><Loading /></main>}><CeremonyPage /></Suspense>} /></Route>
    <Route path="*" element={<Navigate to="/home" replace />} />
  </Routes></HashRouter>;
}
