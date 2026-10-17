import { useTranslation } from '../../i18n/useTranslation';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
export default function StoreCheckoutBar() {
  const { t } = useTranslation();
  const { selectedShop: shop, cartCount, openCart, beginCheckout } = useApp();
  if (!shop) return null;
  return <footer className="app-store-actions" aria-label={t("Acciones de tienda")}><Button variant="secondary" icon="cart" onClick={openCart}>{t('Carrito')}{cartCount ? ` (${cartCount})` : ''}</Button><Button variant="wine" icon="qr" onClick={() => beginCheckout(shop)}>{t("Ir a pagar")}</Button></footer>;
}
