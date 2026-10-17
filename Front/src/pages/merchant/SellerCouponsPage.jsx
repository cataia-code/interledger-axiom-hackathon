import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { DATA_SOURCE } from '../../services/api/client';
import { sellerCouponService } from '../../services/coupons/couponService';
import { sellerService } from '../../services/seller/sellerService';
import { couponMessage } from '../../lib/coupons';
import SellerCouponForm from '../../components/coupons/SellerCouponForm';
import PageHeading, { SectionHeading } from '../../components/ui/PageHeading';
import { Button } from '../../components/ui/Button';

export default function SellerCouponsPage() {
  return DATA_SOURCE === 'api' ? <ApiSellerCoupons /> : <MockNotice />;
}
function MockNotice() {
  const { t } = useTranslation();
  return <PageHeading title="Cupones de mi tienda" description={t('La gestión de cupones requiere el modo API.')} />;
}
function ApiSellerCoupons() {
  const { t } = useTranslation();
  const { user, ownedShop, navigate, notify } = useApp();
  const [data, setData] = useState({ loading: true, coupons: [], items: [], error: '' });
  const [mode, setMode] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detailPending, setDetailPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [emails, setEmails] = useState('');
  const [assignment, setAssignment] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true; setData(current => ({ ...current, loading: true, error: '' }));
    Promise.allSettled([sellerCouponService.list(), sellerService.listAllItems()]).then(([coupons, items]) => {
      if (active) setData({ loading: false, coupons: coupons.status === 'fulfilled' ? coupons.value : [], items: items.status === 'fulfilled' ? items.value : [], error: coupons.status === 'rejected' ? coupons.reason.message : '' });
    });
    return () => { active = false; };
  }, [user.id, revision]);
  useEffect(() => {
    setError(''); setEmails(''); setAssignment(null); setConfirmDelete(false); setSelected(null);
    if (!mode || mode === 'new') return;
    const controller = new AbortController(); setDetailPending(true);
    sellerCouponService.get(mode, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setSelected(result.coupon); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message); }).finally(() => { if (!controller.signal.aborted) setDetailPending(false); });
    return () => controller.abort();
  }, [mode]);
  function done() { setMode(null); setError(''); setRevision(value => value + 1); }
  async function save(body) {
    if (busy) return; setBusy(true); setError('');
    try { if (mode === 'new') await sellerCouponService.create(body); else await sellerCouponService.update(mode, body); notify(t('Cupón guardado.')); done(); }
    catch (cause) { setError(cause.code === 'COUPON_IN_USE' ? t('El cupón está en uso. Revisa qué datos puedes modificar.') : couponMessage(cause.code, cause.message)); }
    finally { setBusy(false); }
  }
  async function assign(event) {
    event.preventDefault(); if (busy || !selected) return;
    const list = [...new Set(emails.split(/[\s,;]+/).map(value => value.trim()).filter(Boolean))];
    if (!list.length || list.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) { setError(t('Introduce correos válidos separados por comas.')); return; }
    setBusy(true); setError(''); setAssignment(null);
    try { const result = await sellerCouponService.assign(selected.id, list); setAssignment(result); setEmails(''); notify(t('Asignación procesada.')); }
    catch (cause) { setError(couponMessage(cause.code, cause.message)); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (busy || !selected) return; setBusy(true); setError('');
    try { await sellerCouponService.remove(selected.id); notify(t('Cupón eliminado.')); done(); }
    catch (cause) { setError(cause.code === 'COUPON_IN_USE' ? t('No se puede eliminar: hay compras pendientes con este cupón.') : cause.message); }
    finally { setBusy(false); }
  }
  const quantity = value => Array.isArray(value) ? value.length : typeof value === 'number' ? value : '—';
  return <><PageHeading eyebrow="TU NEGOCIO" title="Cupones de mi tienda" description="Crea beneficios y asígnalos a compradores por correo." onBack={busy ? undefined : () => mode ? setMode(null) : navigate('seller')} />
    {error && <p role="alert" className="field-error">{t(error)}</p>}
    {mode === 'new' ? <SellerCouponForm currency={ownedShop.currency} items={data.items} busy={busy} onSave={save} onCancel={() => setMode(null)} /> : mode ? detailPending ? <p role="status">{t('Cargando cupón…')}</p> : selected ? <>
      <SellerCouponForm key={selected.id} coupon={selected} currency={ownedShop.currency} busy={busy} onSave={save} onCancel={() => setMode(null)} />
      <SectionHeading title="Asignar a compradores" /><form className="account-form" onSubmit={assign}><label htmlFor="coupon-assign-emails">{t('Correos de compradores')}<textarea id="coupon-assign-emails" value={emails} onChange={event => setEmails(event.target.value)} placeholder="comprador@example.com" rows="3" required disabled={busy} /></label><small>{t('Solo cuentas de comprador existentes. Separa los correos con comas.')}</small><Button type="submit" disabled={busy || !emails.trim()}>{t('Asignar cupón')}</Button></form>
      {assignment && <div className="surface information-card" role="status"><p>{t('Asignados')}: {quantity(assignment.assigned)}</p><p>{t('Ya lo tenían')}: {quantity(assignment.alreadyHad)}</p><p>{t('No encontrados')}: {quantity(assignment.notFound)}</p></div>}
      {confirmDelete ? <div className="surface information-card"><p>{t('¿Eliminar este cupón de tu tienda?')}</p><Button variant="outline" disabled={busy} onClick={remove}>{t('Confirmar eliminación')}</Button><Button variant="quiet" disabled={busy} onClick={() => setConfirmDelete(false)}>{t('Cancelar')}</Button></div> : <Button className="wide space-top" variant="outline" disabled={busy} onClick={() => setConfirmDelete(true)}>{t('Eliminar cupón')}</Button>}
    </> : <Button onClick={() => setMode(null)}>{t('Volver')}</Button> : <>
      <Button className="wide" disabled={data.loading || !ownedShop?.currency} onClick={() => setMode('new')}>{t('Crear cupón')}</Button>
      {data.loading ? <p role="status">{t('Cargando cupones…')}</p> : data.error ? <div role="alert"><p>{data.error}</p><Button onClick={() => setRevision(value => value + 1)}>{t('Reintentar')}</Button></div> : data.coupons.length ? <div className="seller-coupon-list">{data.coupons.map(coupon => <article className="surface information-card" key={coupon.id}><h2>{coupon.title}</h2><p>{coupon.code || t('Sin código público')} · {t(({ active: 'Activo', paused: 'Pausado', expired: 'Vencido' })[coupon.status] || coupon.status)}</p><Button variant="secondary" onClick={() => setMode(coupon.id)}>{t('Gestionar cupón')}</Button></article>)}</div> : <p className="caption">{t('Todavía no has creado cupones.')}</p>}
    </>}
  </>;
}
