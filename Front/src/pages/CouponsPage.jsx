import { useState } from 'react';
import PageHeading from '../components/ui/PageHeading';
import FilterChips from '../components/ui/FilterChips';
import Icon from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import StoreLogo from '../components/shops/StoreLogo';
import { coupons } from '../data/coupons';
import { getShop } from '../data/shops';
import { useApp } from '../context/AppContext';
export default function CouponsPage() {
  const [filter, setFilter] = useState('Todos');
  const { activeCoupons, setActiveCoupons, notify, openShop } = useApp();
  const filtered = coupons.filter(coupon => { const shop = getShop(coupon.shopId); return filter === 'Todos' || (filter === 'Cercanos' ? Number.parseFloat(shop.distance) <= 1.1 : shop.category === filter); });
  function activate(coupon) { setActiveCoupons(current => [...current, coupon.id]); notify('Cupón guardado. Muéstralo en la tienda al comprar.'); }
  return <><PageHeading eyebrow="BENEFICIOS LOCALES" title="Cupones para ti" description="Descubre ofertas en comercios locales." />
    <div className="coupon-banner"><div><span className="eyebrow">AHORRA MIENTRAS DESCUBRES</span><h2>Más experiencias,<br />mejor precio.</h2><p>Beneficios que te acercan a lo local.</p></div><Icon name="ticket" /></div>
    <FilterChips options={['Todos', 'Cercanos', 'Gastronomía', 'Artesanías']} value={filter} onChange={setFilter} />
    <div className="coupon-list">{filtered.map(coupon => { const shop = getShop(coupon.shopId); const saved = activeCoupons.includes(coupon.id); return <article className="surface coupon-card" key={coupon.id}>
      <button className="coupon-card__shop" onClick={() => openShop(shop.id)} aria-label={`Ver tienda ${shop.name}`}><StoreLogo shop={shop} /></button>
      <div><h2>{coupon.title}</h2><b>{shop.name}</b><p>{coupon.description}</p><small>Válido hasta {new Date(`${coupon.expires}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</small>
        <Button variant={saved ? 'quiet' : 'secondary'} icon={saved ? 'check' : 'ticket'} disabled={saved} onClick={() => activate(coupon)}>{saved ? 'Guardado' : 'Guardar cupón'}</Button>
      </div></article>; })}</div>
  </>;
}
