import { useTranslation } from '../i18n/useTranslation';
import { useApp } from '../context/AppContext';
import PageHeading from '../components/ui/PageHeading';
import CartContents from '../components/cart/CartContents';
export default function CartPage() {
  const { t } = useTranslation();
  const { navigate, cartCount } = useApp();
  return <><PageHeading eyebrow={t("DE TU WALLET AL COMERCIO LOCAL")} title={t("Tu carrito")} description={t(cartCount === 1 ? '{{count}} producto para disfrutar. Revisa tus productos y el total de la tienda.' : '{{count}} productos para disfrutar. Revisa tus productos y el total de la tienda.', {count: cartCount})} onBack={() => navigate('home/list')} /><CartContents /></>;
}
