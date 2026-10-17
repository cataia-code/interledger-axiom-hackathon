import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useTranslation } from '../i18n/useTranslation';
import { language } from '../i18n/instance';
import { couponService } from '../services/coupons/couponService';
import { resolveImageURL } from '../services/api/client';
import { minorToMajor } from '../services/marketplace/itemAdapter';
import { couponMessage, couponStates } from '../lib/coupons';
import { money } from '../lib/currency';
import PageHeading from '../components/ui/PageHeading';
import FilterChips from '../components/ui/FilterChips';
import StoreLogo from '../components/shops/StoreLogo';
import Icon from '../components/ui/Icon';
import { Button } from '../components/ui/Button';

function dateLabel(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat(language(), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}
export default function ApiCouponsPage() {
  const { t } = useTranslation();
  const { user, findShop, cartDetails, cartCount, cartPending, applyCoupon, navigate, openShop, openCart, notify, param } = useApp();
  const [data, setData] = useState({ loading: true, coupons: [], error: '' });
  const [filter, setFilter] = useState('Todos');
  const [storeFilter, setStoreFilter] = useState(param || '');
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');
  const submitting = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setData({ loading: true, coupons: [], error: '' }); setActionError('');
    couponService.list({}, { signal: controller.signal }).then(coupons => { if (!controller.signal.aborted) setData({ loading: false, coupons, error: '' }); })
      .catch(cause => { if (!controller.signal.aborted) setData({ loading: false, coupons: [], error: cause.message }); });
    return () => controller.abort();
  }, [user.id, revision]);
  const stores = [...new Map(data.coupons.map(coupon => [String(coupon.storeId), coupon.store?.name || findShop(String(coupon.storeId))?.name || t('Comercio local')])).entries()];
  const filtered = data.coupons.filter(coupon => (!storeFilter || String(coupon.storeId) === storeFilter)
    && (filter === 'Todos' || (filter === 'Guardados' ? coupon.inWallet : coupon.state === 'available')));
  function actionLabel(coupon) {
    if (String(cartDetails?.coupon?.id) === String(coupon.id)) return 'Aplicado al carrito';
    if (coupon.state !== 'available') return couponStates[coupon.state] || 'No disponible';
    if (cartCount && String(cartDetails?.storeId) === String(coupon.storeId)) return 'Toca para aplicar al carrito';
    return coupon.inWallet ? 'Guardado · Ver tienda' : 'Guardar y ver tienda';
  }
  async function activate(coupon) {
    if (submitting.current || cartPending || coupon.state !== 'available') return;
    submitting.current = true; setBusyId(coupon.id); setActionError('');
    try {
      if (!coupon.inWallet) {
        await couponService.claim(coupon.id);
        setData(current => ({ ...current, coupons: current.coupons.map(item => String(item.id) === String(coupon.id) ? { ...item, inWallet: true, source: 'claimed' } : item) }));
      }
      if (!cartCount) { openShop(String(coupon.storeId)); notify(t('Añade productos de esta tienda y aplica tu cupón en el carrito.')); return; }
      if (String(cartDetails?.storeId) !== String(coupon.storeId)) {
        notify(t('Tu carrito contiene otra tienda. Finaliza esa compra o vacíalo antes de cambiar de comercio.')); openCart(); return;
      }
      if (String(cartDetails?.coupon?.id) === String(coupon.id)) { navigate('cart'); return; }
      const success = await applyCoupon({ couponId: coupon.id });
      if (success) { notify(t('Cupón aplicado. El total de tu compra se ha actualizado.')); navigate('cart'); }
      else openCart();
    } catch (cause) { setActionError(couponMessage(cause.code, cause.message)); }
    finally { submitting.current = false; setBusyId(null); }
  }
  return <><PageHeading eyebrow="BENEFICIOS LOCALES" title="Cupones para ti" description="Selecciona un cupón de tu tienda para descontarlo de la compra." />
    <div className="coupon-banner"><div><span className="eyebrow">{t('AHORRA MIENTRAS DESCUBRES')}</span><h2>{t('Más experiencias,')}<br />{t('mejor precio.')}</h2><p>{t('Un cupón por pedido, sin mezclar tiendas.')}</p></div><Icon name="ticket" /></div>
    <FilterChips options={['Todos', 'Guardados', 'Disponibles']} value={filter} onChange={setFilter} />
    <label className="coupon-store-filter" htmlFor="coupon-store-filter">{t('Filtrar por tienda')}<select id="coupon-store-filter" value={storeFilter} onChange={event => setStoreFilter(event.target.value)}><option value="">{t('Todas las tiendas')}</option>{param && !stores.some(([id]) => id === param) && <option value={param}>{t('Tienda del carrito')}</option>}{stores.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
    {actionError && <p role="alert" className="field-error">{t(actionError)}</p>}
    {data.loading ? <p role="status" className="caption">{t('Cargando cupones…')}</p> : data.error ? <div role="alert" className="surface information-card"><p>{t(data.error)}</p><Button onClick={() => setRevision(value => value + 1)}>{t('Reintentar')}</Button></div> : !filtered.length ? <div className="surface information-card"><h2>{t('No hay cupones para este filtro.')}</h2><p>{t('Aquí aparecerán los cupones que te asignen y los públicos que puedas guardar.')}</p></div> : <div className="coupon-list">{filtered.map(coupon => {
      const cached = findShop(String(coupon.storeId));
      const shop = { ...cached, name: coupon.store?.name || cached?.name || t('Comercio local'), logo: resolveImageURL(coupon.store?.iconUrl) || cached?.logo || '/assets/store-logo-fallback.svg' };
      const currency = coupon.store?.currency || cached?.currency;
      const benefit = coupon.type === 'percent' ? `${new Intl.NumberFormat(language(), { maximumFractionDigits: 2 }).format(coupon.value / 100)}%` : currency ? money(minorToMajor(coupon.value, currency), currency) : '';
      const available = coupon.state === 'available';
      const action = actionLabel(coupon);
      const ends = dateLabel(coupon.endsAt), starts = dateLabel(coupon.startsAt);
      return <button type="button" className={`surface coupon-card api-coupon-card ${available ? '' : 'is-unavailable'}`} key={coupon.id} disabled={!available || busyId != null || cartPending} onClick={() => activate(coupon)} aria-label={`${coupon.title} · ${shop.name} · ${t(action)}`} aria-busy={busyId === coupon.id}>
        <span className="coupon-card__shop"><StoreLogo shop={shop} /></span><span className="coupon-card__content"><span className="coupon-card__title">{coupon.title}</span><b>{shop.name}</b><span className="coupon-card__benefit">{benefit}</span><span className="coupon-card__description">{coupon.description}</span>
        {currency && coupon.minSubtotalAmount > 0 && <small>{t('Compra mínima')}: {money(minorToMajor(coupon.minSubtotalAmount, currency), currency)}</small>}
        {currency && coupon.maxDiscountAmount != null && <small>{t('Descuento máximo')}: {money(minorToMajor(coupon.maxDiscountAmount, currency), currency)}</small>}
        {coupon.itemIds?.length > 0 && <small>{t('Solo en productos seleccionados.')}</small>}
        {coupon.perUserLimit != null && <small>{t('Usos por persona')}: {coupon.perUserLimit}</small>}
        {coupon.state === 'upcoming' && starts && <small>{t('Disponible desde')}: {starts}</small>}
        <small>{ends ? `${t('Válido hasta')}: ${ends}` : t('Sin fecha de vencimiento')}</small>
        <span className="coupon-status"><Icon name={coupon.inWallet ? 'check' : 'ticket'} />{busyId === coupon.id ? t('Procesando…') : t(action)}</span></span>
      </button>;
    })}</div>}
  </>;
}
