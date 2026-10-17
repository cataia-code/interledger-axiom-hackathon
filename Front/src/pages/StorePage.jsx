import { useState } from 'react';
import { useApp } from '../context/AppContext';
import StoreLogo from '../components/shops/StoreLogo';
import ProductCard from '../components/shops/ProductCard';
import Rating from '../components/ui/Rating';
import Icon from '../components/ui/Icon';
import { Button, IconButton } from '../components/ui/Button';
import { money } from '../lib/currency';
export default function StorePage() {
  const { selectedShop: shop, navigate, favorites, toggleFavorite, addProduct, cart, setAmount, setSelectedShopId } = useApp();
  const [tab, setTab] = useState('Productos');
  const items = cart.filter(item => item.shopId === shop.id);
  const total = items.reduce((sum, item) => sum + item.price, 0);
  function pay() { setSelectedShopId(shop.id); setAmount(total || shop.price); navigate('scanner'); }
  return <><div className="store-hero"><div className="brand-orbit" /><StoreLogo shop={shop} className="store-logo--hero" />
    <div className="hero-controls"><IconButton icon="arrowLeft" label="Volver al mapa" onClick={() => navigate('map')} /><IconButton icon="heart" label="Guardar tienda" className={favorites.includes(shop.id) ? 'is-saved' : ''} aria-pressed={favorites.includes(shop.id)} onClick={() => toggleFavorite(shop.id)} /></div>
  </div><section className="store-profile"><span className="eyebrow">{shop.category} · {shop.distance}</span><h1>{shop.name}</h1>
    <div className="store-rating"><Rating value={shop.rating} reviews={shop.reviews} /><span>{shop.area}</span></div><p className="store-description">{shop.description}</p>
    <div className="store-traits">{[[shop.categoryIcon, shop.type], ['shop', 'Hecho local'], ['wallet', 'Pago con Lokora']].map(([icon, label]) => <span key={label}><Icon name={icon} />{label}</span>)}</div>
    <div className="tabs" role="tablist" aria-label="Detalle de la tienda">{['Productos', 'Información', 'Reseñas'].map(item => <button key={item} role="tab" aria-selected={item === tab} aria-controls="store-tab-panel" id={`tab-${item}`} className={item === tab ? 'is-active' : ''} onClick={() => setTab(item)}>{item}</button>)}</div>
    <div id="store-tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} key={tab} className="tab-content">
      {tab === 'Productos' && <div className="product-grid">{shop.products.map(product => <ProductCard key={product.id} product={product} onAdd={item => addProduct(shop, item)} />)}</div>}
      {tab === 'Información' && <div className="surface information-card"><h2>Nos encuentras aquí</h2><p><Icon name="pin" />{shop.area}</p><p>{shop.description}</p><p>Hoy: 9:00 a. m. – 7:00 p. m.</p><small>Comercio y horario de demostración.</small></div>}
      {tab === 'Reseñas' && <div className="surface information-card"><Rating value={shop.rating} reviews={shop.reviews} /><blockquote>“Una experiencia hermosa y muy local.”</blockquote><p>Viajero Lokora · Reseña de ejemplo</p></div>}
    </div>
    <div className="store-checkout"><span>{items.length ? `${items.length} productos · ${money(total)}` : 'Descubre su catálogo local'}</span><Button variant="wine" icon="qr" onClick={pay}>Pagar con QR</Button></div>
  </section></>;
}
