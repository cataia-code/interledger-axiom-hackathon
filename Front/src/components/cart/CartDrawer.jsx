import { useTranslation } from '../../i18n/useTranslation';
import { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Button, IconButton } from '../ui/Button';
import Icon from '../ui/Icon';
import CartContents from './CartContents';
export default function CartDrawer() {
  const { t } = useTranslation();
  const { cartOpen, closeCart, cartCount, navigate } = useApp();
  const ref = useRef(null);
  useEffect(() => {
    if (cartOpen && !ref.current.open) ref.current.showModal();
    if (!cartOpen && ref.current.open) ref.current.close();
  }, [cartOpen]);
  return <dialog ref={ref} className="cart-drawer" aria-labelledby="cart-title" onCancel={closeCart} onClick={event => { if (event.target === event.currentTarget) closeCart(); }}>
    <div className="cart-drawer__content"><header><span><Icon name="cart" /><h2 id="cart-title">{t("Tu carrito")}</h2><small>{t(cartCount === 1 ? '{{count}} producto' : '{{count}} productos', {count: cartCount})}</small></span><IconButton icon="close" label={t("Cerrar carrito")} onClick={closeCart} /></header>
      <Button className="wide cart-expand" variant="secondary" icon="arrowRight" onClick={() => { closeCart(); navigate('cart'); }}>{t("Ver carrito completo")}</Button>
      <CartContents onNavigate={closeCart} />
    </div>
  </dialog>;
}
