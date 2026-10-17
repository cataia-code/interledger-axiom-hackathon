import { language } from '../i18n/instance';
import { useTranslation } from '../i18n/useTranslation';
import { useState } from 'react';
import PageHeading from '../components/ui/PageHeading';
import FilterChips from '../components/ui/FilterChips';
import Icon from '../components/ui/Icon';
import StoreLogo from '../components/shops/StoreLogo';
import { coupons } from '../data/coupons';
import { useApp } from '../context/AppContext';
import { DATA_SOURCE } from '../services/api/client';
import ApiCouponsPage from './ApiCouponsPage';
export default function CouponsPage() {
  return DATA_SOURCE === 'api' ? <ApiCouponsPage /> : <MockCouponsPage />;
}
function MockCouponsPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('Todos');
  const { activeCoupons, setActiveCoupons, notify, findShop: getShop } = useApp();
  const filtered = coupons.filter(coupon => { const shop = getShop(coupon.shopId); if (!shop) return false; return filter === 'Todos' || (filter === 'Cercanos' ? Number.parseFloat(shop.distance) <= 1.1 : shop.category === filter); });
  function activate(coupon) { const saved = activeCoupons.includes(coupon.id); setActiveCoupons(current => saved ? current.filter(id => id !== coupon.id) : [...current, coupon.id]); notify(saved ? 'Cupón retirado de tus guardados.' : 'Cupón guardado. Muéstralo en la tienda al comprar.'); }
  return <><PageHeading eyebrow={t("BENEFICIOS LOCALES")} title={t("Cupones para ti")} description={t("Descubre ofertas en comercios locales.")} />
    <div className="coupon-banner"><div><span className="eyebrow">{t("AHORRA MIENTRAS DESCUBRES")}</span><h2>{t("Más experiencias,")}<br />{t("mejor precio.")}</h2><p>{t("Beneficios que te acercan a lo local.")}</p></div><Icon name="ticket" /></div>
    <FilterChips options={['Todos', 'Cercanos', 'Gastronomía', 'Artesanías']} value={filter} onChange={setFilter} />
    <div className="coupon-list">{filtered.map(coupon => { const shop = getShop(coupon.shopId); const saved = activeCoupons.includes(coupon.id); return <button type="button" className="surface coupon-card" key={coupon.id} aria-pressed={saved} onClick={() => activate(coupon)}>
      <span className="coupon-card__shop"><StoreLogo shop={shop} /></span>
      <span className="coupon-card__content"><span className="coupon-card__title">{coupon.title}</span><b>{shop.name}</b><span className="coupon-card__description">{coupon.description}</span><small>Válido hasta {new Date(`${coupon.expires}T12:00:00`).toLocaleDateString(language(), { day: 'numeric', month: 'short', year: 'numeric' })}</small>
        <span className="coupon-status"><Icon name={saved ? 'check' : 'ticket'} />{saved ? 'Guardado' : 'Toca para guardar'}</span>
      </span></button>; })}</div>
  </>;
}
