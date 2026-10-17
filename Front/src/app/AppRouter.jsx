import { useApp } from '../context/AppContext';
import WelcomePage from '../pages/WelcomePage';
import ExplorePage from '../pages/ExplorePage';
import MapPage from '../pages/MapPage';
import StorePage from '../pages/StorePage';
import CouponsPage from '../pages/CouponsPage';
import ScannerPage from '../pages/ScannerPage';
import PaymentPage from '../pages/PaymentPage';
import PaymentSuccessPage from '../pages/PaymentSuccessPage';
import WalletPage from '../pages/WalletPage';
import ProfilePage from '../pages/ProfilePage';
import ImpactPage from '../pages/ImpactPage';
import ImpactDetailPage from '../pages/ImpactDetailPage';
import SellerPage from '../pages/merchant/SellerPage';
import SalesStatsPage from '../pages/merchant/SalesStatsPage';
import ScheduledPaymentsPage from '../pages/merchant/ScheduledPaymentsPage';
import PaymentSettingsPage from '../pages/merchant/PaymentSettingsPage';

const pages = { welcome: WelcomePage, explore: ExplorePage, map: MapPage, store: StorePage,
  coupons: CouponsPage, scanner: ScannerPage, payment: PaymentPage, success: PaymentSuccessPage,
  wallet: WalletPage, profile: ProfilePage, impact: ImpactPage, impactDetail: ImpactDetailPage,
  seller: SellerPage, stats: SalesStatsPage, scheduled: ScheduledPaymentsPage, settings: PaymentSettingsPage,
};
export default function AppRouter() {
  const { route } = useApp();
  const Page = pages[route] ?? WelcomePage;
  return <Page />;
}
