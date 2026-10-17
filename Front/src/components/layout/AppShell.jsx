import { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import AppHeader from './AppHeader';
import BottomNav from './BottomNav';
import PageTransition from './PageTransition';
import { AppDialog, Toast } from '../ui/Feedback';

const navRoutes = new Set(['explore', 'map', 'coupons', 'impact', 'profile']);
export default function AppShell({ children }) {
  const { route, path } = useApp();
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [path]);
  return <div className="app-frame">
    {!['welcome', 'scanner'].includes(route) && <AppHeader />}
    <main ref={scrollRef} className={`app-screen ${route === 'map' ? 'app-screen--map' : ''} ${route === 'welcome' ? 'app-screen--welcome' : ''}`} id="appScreen">
      <PageTransition routeKey={path} className={`page-${route}`}>{children}</PageTransition>
    </main>
    {navRoutes.has(route) && <BottomNav />}
    <Toast /><AppDialog />
  </div>;
}
