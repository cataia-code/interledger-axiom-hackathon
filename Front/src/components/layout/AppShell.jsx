import { useTranslation } from '../../i18n/useTranslation';
import { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import CartDrawer from '../cart/CartDrawer';
import AppHeader from './AppHeader';
import BottomNav from './BottomNav';
import StoreCheckoutBar from '../shops/StoreCheckoutBar';
import PageTransition from './PageTransition';
import { AppDialog, Toast } from '../ui/Feedback';

const navRoutes = new Set(['home', 'explore', 'map', 'coupons', 'impact', 'profile', 'seller', 'stats', 'scheduled', 'settings']);
export default function AppShell({ children }) {
  const { t } = useTranslation();
  const { route, path, user, restoring } = useApp();
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [path]);
  if (restoring) return <div className="app-frame"><main className="app-screen"><div className="empty-state" role="status">{t("Recuperando tu sesión…")}</div></main></div>;
  return <div className="app-frame">
    {user && !['welcome', 'login', 'register'].includes(route) && <AppHeader />}
    <main ref={scrollRef} className={`app-screen ${['home', 'map', 'explore'].includes(route) ? 'app-screen--home' : ''} ${route === 'welcome' ? 'app-screen--welcome' : ''}`} id="appScreen">
      <PageTransition routeKey={path} className={`page-${route}`}>{children}</PageTransition>
    </main>
    {user && navRoutes.has(route) && <BottomNav />}
    {user?.role === 'buyer' && route === 'store' && <StoreCheckoutBar />}
    {user?.role === 'buyer' && <CartDrawer />}<Toast />{user && <AppDialog />}
  </div>;
}
