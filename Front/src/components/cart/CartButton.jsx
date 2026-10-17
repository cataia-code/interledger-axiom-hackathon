import { useTranslation } from '../../i18n/useTranslation';
import { useApp } from '../../context/AppContext';
import Icon from '../ui/Icon';
export default function CartButton({ className = '' }) {
  const { t } = useTranslation();
  const { cartCount, openCart } = useApp();
  return <button className={`icon-button cart-trigger ${className}`} aria-label={t(cartCount === 1 ? 'Abrir carrito, {{count}} producto' : 'Abrir carrito, {{count}} productos', {count: cartCount})} onClick={openCart}>
    <Icon name="cart" />{cartCount > 0 && <span className="cart-trigger__count" aria-hidden="true" key={cartCount}>{cartCount > 99 ? '99+' : cartCount}</span>}
  </button>;
}
