import { useTranslation } from '../../i18n/useTranslation';
import { useApp } from '../../context/AppContext';
import ShopCard from '../shops/ShopCard';
import Icon from '../ui/Icon';
import { Button } from '../ui/Button';
export default function StoreList({ shops, onReset }) {
  const { t } = useTranslation();
  const { openShop, favorites, toggleFavorite } = useApp();
  if (!shops.length) return <div className="empty-state"><Icon name="search" /><p>{t("No encontramos tiendas con esa búsqueda.")}</p><Button variant="secondary" onClick={onReset}>{t("Ver todas las tiendas")}</Button></div>;
  return <div className="shop-list">{shops.map(shop => <ShopCard key={shop.id} shop={shop} onOpen={openShop} isFavorite={favorites.includes(shop.id)} onFavorite={toggleFavorite} />)}</div>;
}
