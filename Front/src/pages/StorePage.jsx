import { useTranslation } from '../i18n/useTranslation';
import { DATA_SOURCE } from '../services/api/client';
import { useState } from 'react';
import { useStoreDetail } from '../hooks/useStoreDetail';
import { useApp } from '../context/AppContext';
import StoreLogo from '../components/shops/StoreLogo';
import CoverImage from '../components/shops/CoverImage';
import ProductCard from '../components/shops/ProductCard';
import Rating from '../components/ui/Rating';
import Icon from '../components/ui/Icon';
import { Button, IconButton } from '../components/ui/Button';
export default function StorePage() {
  const { t } = useTranslation();
  const { selectedShop, selectedShopId, param, cacheStore, navigate, favorites, toggleFavorite, addProduct, ownedShop, user } = useApp();
  const { store: shop, pending, error } = useStoreDetail(param || selectedShopId, selectedShop, cacheStore);
  const [tab, setTab] = useState('Productos');
  if (!shop) return <div className="empty-state"><p>{pending ? 'Cargando tienda…' : error || 'No encontramos esta tienda.'}</p><Button onClick={() => navigate('home/list')}>{t("Ver tiendas")}</Button></div>;
  return <><div className="store-hero store-hero--photo"><CoverImage key={shop.cover} src={shop.cover} fallback={shop.products[0]?.image} alt={`Portada de ${shop.name}`} className="store-cover-photo" /><StoreLogo shop={shop} className="store-logo--badge" />
    <div className="hero-controls"><IconButton icon="arrowLeft" label={t("Volver a las tiendas")} onClick={() => navigate('home/list')} /><IconButton icon="heart" label={t("Guardar tienda")} className={favorites.includes(shop.id) ? 'is-saved' : ''} aria-pressed={favorites.includes(shop.id)} onClick={() => toggleFavorite(shop.id)} /></div>
  </div><section className="store-profile"><div className="store-title-row"><h1>{shop.name}</h1>{shop.rating > 0 ? <Rating value={shop.rating} reviews={shop.reviews} /> : <span className="offer-pill">{t(DATA_SOURCE === 'api' ? 'Sin puntuación' : 'Nueva tienda')}</span>}</div>
    <p className="store-location">{shop.distance} · {shop.area}</p><p className="store-description">{shop.description}</p>
    <div className="store-traits">{[[shop.categoryIcon, shop.type], ['shield', 'Hecho local'], ['wallet', 'Pago con Lokora']].map(([icon, label]) => <span key={label}><i><Icon name={icon} /></i>{t(label)}</span>)}</div>
    <div className="tabs" role="tablist" aria-label={t("Detalle de la tienda")}>{['Productos', 'Información', 'Reseñas'].map(item => <button key={item} role="tab" aria-selected={item === tab} aria-controls="store-tab-panel" id={`tab-${item}`} className={item === tab ? 'is-active' : ''} onClick={() => setTab(item)}>{t(item)}</button>)}</div>
    <div id="store-tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} key={tab} className="tab-content">
      {tab === 'Productos' && (shop.products.length ? <div className="product-grid">{shop.products.map(product => <ProductCard key={product.id} product={product} cover={shop.cover} isFavorite={favorites.includes(product.id)} onFavorite={toggleFavorite} onAdd={user?.role === 'buyer' ? item => addProduct(shop, item) : undefined} />)}</div> : <div className="empty-state"><Icon name="shop" /><h2>{t("Un nuevo lugar por descubrir.")}</h2><p>{t("Esta tienda está preparando su catálogo.")}</p>{ownedShop?.id === shop.id && <Button variant="secondary" onClick={() => navigate('seller')}>{t("Ir a mi negocio")}</Button>}</div>)}
      {tab === 'Información' && <div className="surface information-card"><h2>{t("Nos encuentras aquí")}</h2><p><Icon name="pin" />{shop.address ? `${shop.address} · ` : ''}{shop.area}</p><p>{shop.description}</p>{DATA_SOURCE === 'mock' && <p>Comercio de demostración en Medellín.</p>}</div>}
      {tab === 'Reseñas' && <div className="surface information-card">{shop.rating > 0 ? <><Rating value={shop.rating} reviews={shop.reviews} /><blockquote>“Una experiencia hermosa y muy local.”</blockquote><p>Viajero Lokora · Reseña de ejemplo</p></> : <p>{t("Esta tienda todavía no tiene reseñas.")}</p>}</div>}
    </div>
  </section></>;
}
