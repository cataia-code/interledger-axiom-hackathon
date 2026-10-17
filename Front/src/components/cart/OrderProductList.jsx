import { useTranslation } from '../../i18n/useTranslation';
import ProductThumbnail from '../shops/ProductThumbnail';
import { money } from '../../lib/currency';
export default function OrderProductList({ items, currency }) {
  const { t } = useTranslation();
  return <section className="order-products" aria-label={t("Productos de tu compra")}><h2>{t("Tu compra")}</h2><div className="surface order-products__list">{items.map(item => <article className="order-product" key={item.id}>
    <ProductThumbnail productId={item.id} name={item.name} photo={item.photo} /><div className="order-product__details"><h3>{item.name}</h3><small>{t('Cantidad: {{count}}', {count: item.quantity})}</small><span>{money(item.total, currency)} <small>{currency}</small></span></div>
  </article>)}</div></section>;
}
