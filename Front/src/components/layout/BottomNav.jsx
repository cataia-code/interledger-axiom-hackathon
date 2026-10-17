import { useApp } from '../../context/AppContext';
import Icon from '../ui/Icon';
const links = [{ route: 'explore', icon: 'search', label: 'Explorar' }, { route: 'map', icon: 'pin', label: 'Mapa' },
  { route: 'coupons', icon: 'ticket', label: 'Cupones' }, { route: 'impact', icon: 'people', label: 'Impacto' }, { route: 'profile', icon: 'user', label: 'Perfil' }];
export default function BottomNav() {
  const { route, navigate } = useApp();
  return <nav className="bottom-nav" aria-label="Navegación principal">{links.map(link => <button key={link.route}
    className={`nav-tab ${route === link.route ? 'is-active' : ''}`} aria-current={route === link.route ? 'page' : undefined}
    onClick={() => navigate(link.route)}><span className="nav-symbol"><Icon name={link.icon} /></span><span>{link.label}</span></button>)}</nav>;
}
