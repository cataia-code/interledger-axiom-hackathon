import { useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { productPriceAmount } from '../../lib/productPrice';
import { Button } from '../ui/Button';
function localDate(value) {
  if (!value) return '';
  const date = new Date(value); if (!Number.isFinite(date.getTime())) return '';
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export default function SellerCouponForm({ coupon = null, currency, items = [], onSave, onCancel, busy }) {
  const { t } = useTranslation();
  const editing = Boolean(coupon);
  const [form, setForm] = useState({ title: coupon?.title || '', description: coupon?.description || '', type: 'percent', value: '', code: '', minSubtotalAmount: '', maxDiscountAmount: '', startsAt: '', endsAt: localDate(coupon?.endsAt), maxRedemptions: coupon?.maxRedemptions == null ? '' : String(coupon.maxRedemptions), perUserLimit: '1', audience: 'public', status: coupon?.status || 'active', itemIds: [] });
  const [error, setError] = useState('');
  function change(event) { const { name, value } = event.target; setForm(current => ({ ...current, [name]: value })); setError(''); }
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    setError('');
    const body = { title: form.title.trim() };
    if (!body.title) { setError(t('Escribe un título para el cupón.')); return; }
    // Edition uses only fields that remain mutable even after redemptions.
    if (editing) { body.description = form.description.trim(); body.status = form.status; body.endsAt = form.endsAt ? new Date(form.endsAt).toISOString() : null; body.maxRedemptions = form.maxRedemptions ? Number(form.maxRedemptions) : null; }
    else {
      body.type = form.type;
      body.value = productPriceAmount(form.value, form.type === 'percent' ? 'USD' : currency);
      if (body.value == null || body.value <= 0 || (form.type === 'percent' && body.value > 10000)) { setError(t('Introduce un descuento válido. El porcentaje debe ser mayor que 0 y hasta 100.')); return; }
      body.audience = form.audience;
      if (form.code.trim()) body.code = form.code.trim();
      for (const key of ['minSubtotalAmount', 'maxDiscountAmount']) if (form[key]) {
        const amount = productPriceAmount(form[key], currency);
        if (amount == null) { setError(t('Revisa los importes del cupón, sin separadores de miles.')); return; }
        body[key] = amount;
      }
      if (form.startsAt) body.startsAt = new Date(form.startsAt).toISOString();
      if (form.endsAt) body.endsAt = new Date(form.endsAt).toISOString();
      if (form.maxRedemptions) body.maxRedemptions = Number(form.maxRedemptions);
      body.perUserLimit = Number(form.perUserLimit);
      body.itemIds = form.itemIds.map(Number);
    }
    if (body.maxRedemptions != null && (!Number.isSafeInteger(body.maxRedemptions) || body.maxRedemptions < 1)) { setError(t('El límite de usos debe ser un entero positivo.')); return; }
    if (!editing && (!Number.isSafeInteger(body.perUserLimit) || body.perUserLimit < 1)) { setError(t('El límite de usos debe ser un entero positivo.')); return; }
    await onSave(body);
  }
  return <form className="account-form seller-product-form" onSubmit={submit}><fieldset disabled={busy}>
    <label htmlFor="seller-coupon-title">{t('Título')}<input id="seller-coupon-title" name="title" value={form.title} onChange={change} required /></label>
    {editing ? <><p className="caption">{t('Puedes actualizar estos datos aunque el cupón ya tenga usos. Las condiciones del descuento se conservan.')}</p><label htmlFor="seller-coupon-description">{t('Descripción')}<textarea id="seller-coupon-description" name="description" value={form.description} onChange={change} rows="3" /></label><label htmlFor="seller-coupon-status">{t('Estado')}<select id="seller-coupon-status" name="status" value={form.status} onChange={change}><option value="active">{t('Activo')}</option><option value="paused">{t('Pausado')}</option></select></label></> : <>
      <label htmlFor="seller-coupon-type">{t('Tipo de descuento')}<select id="seller-coupon-type" name="type" value={form.type} onChange={change}><option value="percent">{t('Porcentaje')}</option><option value="fixed">{t('Monto fijo')}</option></select></label>
      <label htmlFor="seller-coupon-value">{t('Descuento')} · {form.type === 'percent' ? '%' : currency}<input id="seller-coupon-value" name="value" inputMode="decimal" value={form.value} onChange={change} required /></label>
      <label htmlFor="seller-coupon-code">{t('Código opcional')}<input id="seller-coupon-code" name="code" value={form.code} onChange={change} autoCapitalize="characters" /></label>
      <label htmlFor="seller-coupon-audience">{t('Quién puede obtenerlo')}<select id="seller-coupon-audience" name="audience" value={form.audience} onChange={change}><option value="public">{t('Público: los compradores pueden guardarlo')}</option><option value="assigned">{t('Asignado: solo compradores que elijas')}</option></select></label>
      {['minSubtotalAmount', 'maxDiscountAmount'].map((key, index) => <label key={key} htmlFor={`seller-coupon-${key}`}>{t(index ? 'Descuento máximo opcional' : 'Compra mínima opcional')} · {currency}<input id={`seller-coupon-${key}`} name={key} inputMode="decimal" value={form[key]} onChange={change} /></label>)}
      <label htmlFor="seller-coupon-start">{t('Inicio opcional')}<input id="seller-coupon-start" type="datetime-local" name="startsAt" value={form.startsAt} onChange={change} /></label>
      <label htmlFor="seller-coupon-per-user">{t('Usos por persona')}<input id="seller-coupon-per-user" type="number" min="1" step="1" name="perUserLimit" value={form.perUserLimit} onChange={change} required /></label>
      {items.length > 0 && <fieldset className="coupon-item-options"><legend>{t('Productos aplicables')}</legend><small>{t('Sin selección, aplica a todos los productos de la tienda.')}</small>{items.map(item => <label key={item.id}><input type="checkbox" checked={form.itemIds.includes(String(item.id))} onChange={event => setForm(current => ({ ...current, itemIds: event.target.checked ? [...current.itemIds, String(item.id)] : current.itemIds.filter(id => id !== String(item.id)) }))} />{item.name}</label>)}</fieldset>}
    </>}
    <label htmlFor="seller-coupon-end">{t('Vencimiento opcional')}<input id="seller-coupon-end" type="datetime-local" name="endsAt" value={form.endsAt} onChange={change} /></label>
    <label htmlFor="seller-coupon-max">{t('Usos totales opcionales')}<input id="seller-coupon-max" type="number" min="1" step="1" name="maxRedemptions" value={form.maxRedemptions} onChange={change} /></label>
  </fieldset>{error && <p className="field-error" role="alert">{error}</p>}<Button type="submit" className="wide" disabled={busy}>{t(busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear cupón')}</Button><Button variant="quiet" className="wide" disabled={busy} onClick={onCancel}>{t('Cancelar')}</Button></form>;
}
