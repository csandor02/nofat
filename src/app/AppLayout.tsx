import { BookOpen, Dumbbell, FileSignature, History, Settings, House } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { BrandMark } from '../components/BrandMark';
import { useBootstrap } from './useClubData';
import './app.css';

const nav = [
  { to: '/home', label: 'Home', icon: House },
  { to: '/today', label: 'Today', icon: Dumbbell },
  { to: '/week', label: 'Week', icon: FileSignature },
  { to: '/cabinet', label: 'Cabinet', icon: History },
];

export function AppLayout() {
  const bootstrap = useBootstrap();
  return <>
    <header className="masthead">
      <NavLink to="/home" className="brand-link"><BrandMark /></NavLink>
      <nav className="desktop-nav" aria-label="Primary navigation">{nav.map(({ to, label }) => <NavLink key={to} to={to}>{label}</NavLink>)}</nav>
      <NavLink to="/settings" className="settings-link" aria-label="Settings"><Settings size={19} /><span>Settings</span></NavLink>
    </header>
    {bootstrap.data?.unseen_result_ids[0] && <div className="ceremony-banner"><BookOpen size={17} /><span>A new weekly account has been sealed.</span><NavLink to={`/ceremony/${bootstrap.data.unseen_result_ids[0]}`}>View the ceremony</NavLink></div>}
    <Outlet context={{ bootstrap }} />
    <nav className="mobile-nav" aria-label="Primary navigation">{nav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to}><Icon size={20} /><span>{label}</span></NavLink>)}</nav>
  </>;
}
