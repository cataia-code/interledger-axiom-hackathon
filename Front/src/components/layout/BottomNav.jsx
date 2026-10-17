import { useTranslation } from '../../i18n/useTranslation';
import { useApp } from '../../context/AppContext';
import Icon from '../ui/Icon';
const links = [{ route: 'home/list', icon: 'search', label: 'Explorar' }, { route: 'home/map', icon: 'pin', label: 'Mapa' }, { route: 'coupons', icon: 'ticket', label: 'Cupones' }, { route: 'impact', icon: 'people', label: 'Impacto' }, { route: 'profile', icon: 'user', label: 'Perfil' }];
export default function BottomNav() {
  const { t } = useTranslation();
  const { route, param, navigate, user } = useApp();
  const navigationLinks = user?.role === 'seller' ? [{ route: 'seller', icon: 'shop', label: 'Mi negocio' }, { route: 'home/list', icon: 'search', label: 'Tiendas' }, { route: 'profile', icon: 'user', label: 'Perfil' }] : links;
  const activeRoute = route === 'map' ? 'home/map' : route === 'explore' ? 'home/list' : route === 'home' ? `home/${param === 'list' ? 'list' : 'map'}` : route;
  return <nav className="bottom-nav" aria-label={t("Navegación principal")}>{navigationLinks.map(link => <button key={link.route} className={`nav-tab ${activeRoute === link.route ? 'is-active' : ''}`} aria-current={activeRoute === link.route ? 'page' : undefined} onClick={() => navigate(link.route)}><span className="nav-symbol"><Icon name={link.icon} /></span><span>{t(link.label)}</span></button>)}</nav>;
}
