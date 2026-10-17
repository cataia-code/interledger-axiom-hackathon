import { useApp } from '../../context/AppContext';
import BrandLogo from './BrandLogo';
import { IconButton } from '../ui/Button';
import CartButton from '../cart/CartButton';
import LanguageSelector from '../language/LanguageSelector';
import LogoutButton from './LogoutButton';
import Icon from '../ui/Icon';
import { useTranslation } from '../../i18n/useTranslation';
export default function AppHeader() {
  const { navigate, user, openAccount, route } = useApp();
  const { t } = useTranslation();
  return <header className="app-header"><a href="#home/map" className="header-brand" onClick={event => { event.preventDefault(); navigate('home/map'); }}><BrandLogo /></a><div className="header-actions"><LanguageSelector />{user?.role === 'buyer' && <><button className={`icon-button header-purchases ${route === 'wallet' ? 'is-active' : ''}`} aria-label={t('Mis compras')} title={t('Mis compras')} aria-current={route === 'wallet' ? 'page' : undefined} onClick={() => navigate('wallet')}><Icon name="receipt" /><span>{t('Compras')}</span></button><CartButton /></>}<IconButton icon="user" label={user ? 'Mi perfil' : 'Iniciar sesión'} onClick={() => user ? navigate('profile') : openAccount('buy', 'home/list')} />{user && <LogoutButton />}</div></header>;
}
