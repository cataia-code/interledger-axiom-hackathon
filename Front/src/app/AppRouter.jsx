import { useTranslation } from '../i18n/useTranslation';
import { useEffect } from 'react';
import { isPublicRoute, isMerchantRoute, isBuyerRoute } from './access';
import { DATA_SOURCE } from '../services/api/client';
import { Button } from '../components/ui/Button';
import { useApp } from '../context/AppContext';
import WelcomePage from '../pages/WelcomePage';
import HomePage from '../pages/HomePage';
import VerifyEmailPage from '../pages/auth/VerifyEmailPage';
import AccountPage from '../pages/auth/AccountPage';
import CreateStorePage from '../pages/merchant/CreateStorePage';
import SellerProductPage from '../pages/merchant/SellerProductPage';
import SellerCouponsPage from '../pages/merchant/SellerCouponsPage';

import StorePage from '../pages/StorePage';
import CouponsPage from '../pages/CouponsPage';
import ScannerPage from '../pages/ScannerPage';
import CartPage from '../pages/CartPage';
import PaymentPage from '../pages/PaymentPage';
import PaymentSuccessPage from '../pages/PaymentSuccessPage';
import PaymentReturnPage from '../pages/PaymentReturnPage';
import WalletPage from '../pages/WalletPage';
import ProfilePage from '../pages/ProfilePage';
import AssociatedWalletsPage from '../pages/AssociatedWalletsPage';
import ImpactPage from '../pages/ImpactPage';
import ImpactDetailPage from '../pages/ImpactDetailPage';
import SellerPage from '../pages/merchant/SellerPage';
import SalesStatsPage from '../pages/merchant/SalesStatsPage';
import ScheduledPaymentsPage from '../pages/merchant/ScheduledPaymentsPage';
import PaymentSettingsPage from '../pages/merchant/PaymentSettingsPage';

const pages = { verifyEmail: VerifyEmailPage, welcome: WelcomePage, home: HomePage, explore: HomePage, map: HomePage, createStore: CreateStorePage, store: StorePage,
  cart: CartPage, coupons: CouponsPage, scanner: ScannerPage, payment: PaymentPage, paymentReturn: PaymentReturnPage, success: PaymentSuccessPage,
  wallets: AssociatedWalletsPage, wallet: WalletPage, profile: ProfilePage, impact: ImpactPage, impactDetail: ImpactDetailPage,
  seller: SellerPage, sellerProduct: SellerProductPage, sellerCoupons: SellerCouponsPage, stats: SalesStatsPage, scheduled: ScheduledPaymentsPage, settings: PaymentSettingsPage,
};
export default function AppRouter() {
  const { t } = useTranslation();
  const { route, path, user, ownedShop, storesStatus, restoring, sessionExpired, openAccount, navigate } = useApp();
  useEffect(() => {
    if (!restoring && !user && !isPublicRoute(route)) {
      if (sessionExpired) navigate('welcome');
      else openAccount(isMerchantRoute(route) ? 'sell' : 'buy', path, 'login');
    }
  }, [restoring, user, sessionExpired, route, path]);
  if (restoring || (!user && !isPublicRoute(route))) return null;
  if (user && ((isMerchantRoute(route) && user.role !== 'seller') || (isBuyerRoute(route) && user.role !== 'buyer'))) return <section className="empty-state"><h1>{t("Acceso según tu cuenta")}</h1><p>{user.role === 'seller' ? 'Las compras requieren una cuenta de comprador.' : 'La gestión de tiendas requiere una cuenta de vendedor.'}</p><Button onClick={() => navigate(user.role === 'seller' ? 'seller' : 'home/list')}>{t("Volver a mi espacio")}</Button></section>;
  if (DATA_SOURCE === 'api' && ['stats', 'scheduled', 'settings'].includes(route)) return <section className="empty-state"><h1>{t("Información no disponible")}</h1><p>{t("Esta sección aún no tiene un endpoint en el contrato recibido.")}</p><Button onClick={() => navigate(user.role === 'seller' ? 'seller' : 'home/list')}>{t("Volver a mi espacio")}</Button></section>;
  if (['seller', 'sellerCoupons', 'stats', 'scheduled', 'settings'].includes(route) && !ownedShop) {
    if (restoring || storesStatus === 'loading') return <p className="caption">{t("Cargando tu negocio…")}</p>;
    if (DATA_SOURCE === 'api') return <section className="empty-state"><h1>{t("No pudimos cargar tu sucursal")}</h1><p>{t("La sucursal debe crearse con el registro de vendedor. Vuelve a intentarlo desde tu perfil.")}</p><Button onClick={() => navigate('profile')}>{t("Mi perfil")}</Button></section>;
    return <CreateStorePage />;
  }
  if (route === 'login') return <AccountPage />;
  if (route === 'register') return <AccountPage register />;
  const Page = pages[route] ?? WelcomePage;
  return <Page />;
}
