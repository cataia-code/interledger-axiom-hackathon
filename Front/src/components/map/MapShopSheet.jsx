import { useTranslation } from '../../i18n/useTranslation';
import StoreLogo from '../shops/StoreLogo';
import Rating from '../ui/Rating';
import { Button } from '../ui/Button';
import { money } from '../../lib/currency';
export default function MapShopSheet({ shop, onOpen, distance }) {
  const { t } = useTranslation();
  return <article className="map-shop-sheet" key={shop.id}><StoreLogo shop={shop} /><div className="map-shop-sheet__body"><h2>{shop.name}</h2><div><span>{shop.category}</span>{shop.rating > 0 && <Rating value={shop.rating} reviews={shop.reviews} />}</div><p>{shop.area}{distance != null && ` · ${distance < 1000 ? `${Math.round(distance)} m` : `${(distance / 1000).toFixed(1)} km`}`} {distance != null && t('(aprox.)')}</p><footer><b>{shop.price > 0 ? t('Desde {{amount}}', {amount:money(shop.price, shop.currency || 'COP')}) : t('Nueva tienda')}</b><Button variant="wine" icon="arrowRight" onClick={() => onOpen(shop.id)}>{t("Ver tienda")}</Button></footer></div></article>;
}
