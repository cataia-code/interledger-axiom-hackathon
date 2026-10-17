import { useId, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { minorToMajor } from '../../services/marketplace/itemAdapter';
import { couponMessage } from '../../lib/coupons';
import { money } from '../../lib/currency';
import { Button } from '../ui/Button';
import Icon from '../ui/Icon';

export function CouponSummary({ coupon, discountAmount = 0, currency }) {
  const { t } = useTranslation();
  if (!coupon && !discountAmount) return null;
  return <div className="coupon-summary"><span><Icon name="ticket" />{coupon?.title || coupon?.code || t('Descuento por cupón')}</span><b>−{money(discountAmount, currency)}</b></div>;
}
export default function CartCoupon({ onNavigate = () => {} }) {
  const { t } = useTranslation();
  const { cartDetails, cartPending, applyCoupon, removeCoupon, navigate } = useApp();
  const inputId = useId();
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [localPending, setLocalPending] = useState(false);
  const disabled = cartPending || localPending;
  if (!cartDetails?.storeId || !cartDetails?.lines?.length) return null;
  async function submit(event) {
    event.preventDefault(); if (!code.trim() || disabled) return;
    setLocalPending(true);
    try { if (await applyCoupon({ code: code.trim() })) { setCode(''); setShowCode(false); } }
    finally { setLocalPending(false); }
  }
  return <section className="surface cart-coupon"><h3><Icon name="ticket" />{t('Cupón de descuento')}</h3>
    {cartDetails.coupon && <><CouponSummary coupon={cartDetails.coupon} currency={cartDetails.currency} discountAmount={minorToMajor(cartDetails.couponDiscountAmount || 0, cartDetails.currency)} /><Button variant="quiet" disabled={disabled} onClick={removeCoupon}>{t('Quitar cupón')}</Button></>}
    {cartDetails.couponError && <p role="alert" className="field-error">{t(couponMessage(cartDetails.couponError))}</p>}
    <Button className="wide" variant="secondary" icon="ticket" disabled={disabled} onClick={() => { onNavigate(); navigate(`coupons/${cartDetails.storeId}`); }}>{t(cartDetails.coupon ? 'Cambiar cupón' : 'Elegir cupón')}</Button>
    {!cartDetails.coupon && <><Button variant="quiet" disabled={disabled} aria-expanded={showCode} aria-controls={`${inputId}-form`} onClick={() => setShowCode(value => !value)}>{t('Tengo un código')}</Button>{showCode && <form id={`${inputId}-form`} onSubmit={submit}><label htmlFor={inputId}>{t('Código opcional')}<input id={inputId} value={code} onChange={event => setCode(event.target.value)} autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder={t('Escribe tu código')} disabled={disabled} required /></label><Button type="submit" variant="secondary" disabled={disabled || !code.trim()}>{t('Aplicar')}</Button></form>}</>}
    <small>{t('Elige un cupón y verás el descuento en el total antes de pagar. Solo puedes usar uno por pedido.')}</small>
  </section>;
}
