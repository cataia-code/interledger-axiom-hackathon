import { useTranslation } from '../i18n/useTranslation';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { orderService } from '../services/orders/orderService';
import { minorToMajor } from '../services/marketplace/itemAdapter';
import OrderProductList from '../components/cart/OrderProductList';
import PageHeading from '../components/ui/PageHeading';
import { Button } from '../components/ui/Button';
import { money } from '../lib/currency';
import { CouponSummary } from '../components/coupons/CartCoupon';
import { couponMessage } from '../lib/coupons';
import { readCheckout, timeRemaining } from '../lib/openPaymentsCheckout';
import OpenPaymentsQuote from '../components/payments/OpenPaymentsQuote';
import { confirmedOrderPayment } from '../lib/paymentStatus';
import { storeWalletService } from '../services/payments/storeWalletService';
import { useStoreReceivingWallet } from '../hooks/useStoreReceivingWallet';
import StoreReceivingWallet from '../components/payments/StoreReceivingWallet';
import PaymentProgress from '../components/payments/PaymentProgress';
import { usePaymentWindow } from '../hooks/usePaymentWindow';
const unwrap = result => result.order || result;
function readAttempt(key) { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; } }
export default function ApiCheckoutPage() {
  const { t } = useTranslation();
  const { user, cartGroups, cartDetails, cartPending, navigate, refreshCart, completeApiPayment } = useApp();
  const storageKey = `lokora:checkout:${user.id}`;
  const saved = useRef(readAttempt(storageKey));
  const createKey = useRef(saved.current?.createKey || orderService.newAttemptKey());
  const payKey = useRef(saved.current?.payKey || orderService.newAttemptKey());
  const paymentId = useRef(saved.current?.paymentId || null);
  const authorizationWindow = usePaymentWindow();
  const windowFinished = useRef(false);
  const [captureConfirmed, setCaptureConfirmed] = useState(false);
  const [order, setOrder] = useState(null);
  const [watching, setWatching] = useState(Boolean(saved.current?.watching));
  const [checkout, setCheckout] = useState(null);
  const [clock, setClock] = useState(Date.now());
  const [verification, setVerification] = useState(0);
  const [pending, setPending] = useState(Boolean(saved.current?.orderId));
  const [phase, setPhase] = useState('Recuperando tu compra…');
  const [error, setError] = useState('');
  const walletRequired = /link your wallet address before paying/i.test(error);
  const group = cartGroups[0];
  const storeId = order?.storeId ?? group?.shopId;
  const receiving = useStoreReceivingWallet(storeId == null ? null : String(storeId));
  const receivingBlocked = storeId != null && (receiving.status !== 'ready' || !receiving.wallet);
  const expiry = checkout ? timeRemaining(checkout.expiresAt, clock) : null;
  function remember(value, nextWatching = watching) {
    try { sessionStorage.setItem(storageKey, JSON.stringify({ orderId: value?.id, createKey: createKey.current, payKey: payKey.current, paymentId: paymentId.current, watching: nextWatching })); } catch { /* Attempt remains in memory. */ }
  }
  function forget() { try { sessionStorage.removeItem(storageKey); } catch { /* Storage can be unavailable. */ } }
  useEffect(() => {
    let active = true;
    if (saved.current?.orderId) orderService.get(saved.current.orderId).then(result => { if (active) setOrder(unwrap(result)); }).catch(cause => { if (active) setError(cause.message); }).finally(() => { if (active) setPending(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!order || !['paid', 'preparing', 'completed'].includes(order.status)) return;
    setWatching(true);
  }, [order?.id, order?.status]);
  useEffect(() => {
    if (!order || !watching) return;
    let active = true; let timer;
    async function poll() {
      let capturedFound = false;
      try {
        const [paymentResult, orderResult] = await Promise.all([orderService.payments(order.id), orderService.get(order.id)]);
        const payments = paymentResult?.payments || [];
        const captured = payments.find(payment => payment.status === 'captured');
        capturedFound = Boolean(captured);
        const currentOrder = unwrap(orderResult);
        if (active) {
          setOrder(currentOrder); setError('');
          if (captured) {
            setCaptureConfirmed(true);
            // Capture is enough to finish the provider interaction. The order
            // may take another poll to reconcile; keep verifying it in Lokora.
            if (!windowFinished.current) { authorizationWindow.close(); windowFinished.current = true; }
          }
          const confirmed = confirmedOrderPayment(currentOrder, payments);
          if (confirmed) {
            forget(); refreshCart().catch(() => {}); completeApiPayment(currentOrder, checkout, confirmed); return;
          }
          if (['cancelled', 'refunded'].includes(currentOrder.status)) {
            authorizationWindow.close();
            forget(); setWatching(false); setCheckout(null); setError('El pedido fue cancelado o reembolsado.'); return;
          }
          const attemptedPayment = payments.find(payment => String(payment.id) === String(paymentId.current));
          if (!captured && attemptedPayment && ['failed', 'cancelled', 'rejected', 'denied'].includes(attemptedPayment.status)) {
            authorizationWindow.close();
            paymentId.current = null; payKey.current = orderService.newAttemptKey();
            remember(currentOrder, false); setWatching(false); setCheckout(null);
            setError('La autorización no se completó. Puedes solicitar otro enlace de pago.'); return;
          }
        }
      } catch (cause) { if (active) { setError(cause.message); if (cause.status === 401 || cause.status === 404) { setWatching(false); return; } } }
      if (active && !capturedFound && checkout && timeRemaining(checkout.expiresAt).expired) {
        setWatching(false); setError('La autorización venció. Renueva el enlace para volver a intentarlo.'); return;
      }
      if (active) timer = setTimeout(poll, 4000);
    }
    poll(); return () => { active = false; clearTimeout(timer); };
  }, [order?.id, watching, checkout?.expiresAt, verification]);
  useEffect(() => {
    if (!watching) return;
    const verify = () => { if (!document.hidden) setVerification(value => value + 1); };
    const returned = event => { if (String(event.detail?.orderId) === String(order?.id)) setVerification(value => value + 1); };
    window.addEventListener('focus', verify);
    window.addEventListener('lokora:payment-return', returned);
    document.addEventListener('visibilitychange', verify);
    return () => { window.removeEventListener('focus', verify); window.removeEventListener('lokora:payment-return', returned); document.removeEventListener('visibilitychange', verify); };
  }, [watching, order?.id]);
  useEffect(() => {
    if (!checkout) return;
    const interval = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [checkout?.expiresAt]);
  const submitting = useRef(false);
  async function pay(renew = false, resume = false) {
    if (submitting.current || pending || receivingBlocked || (watching && !renew && !resume) || (!order && (cartPending || cartDetails?.couponError))) return;
    submitting.current = true; setPending(true); setError(''); setPhase('Verificando la tienda…');
    if (renew) { payKey.current = orderService.newAttemptKey(); setWatching(false); setCheckout(null); setCaptureConfirmed(false); windowFinished.current = false; }
    try {
      // Refresh before reserving stock or requesting a new quote. A buyer's
      // wallet does not establish that this store has a receiving wallet.
      const currentReceiving = await storeWalletService.get(storeId);
      if (!currentReceiving.wallet) {
        receiving.reload();
        throw new Error('La tienda todavía no tiene una wallet receptora principal. Tu wallet de comprador no necesita cambios.');
      }
      let next = order;
      if (!next) {
        setPhase('Preparando tu pedido…');
        remember(null, false);
        next = unwrap(await orderService.create(createKey.current));
        setOrder(next); remember(next, false);
      }
      // The order detail owns frozen prices and line amounts, even after cart checkout.
      next = unwrap(await orderService.get(next.id));
      setOrder(next); remember(next, false);
      if (next.status !== 'pending_payment') return;
      if (!order && group && (next.currency !== group.currency || Math.abs(minorToMajor(next.totalAmount, next.currency) - group.total) > 0.00001)) {
        setError('El total cambió. Revisa el nuevo importe y pulsa Pagar para confirmar.'); return;
      }
      setPhase('Solicitando la cotización de pago…');
      const result = await orderService.pay(next.id, payKey.current);
      // Validate the payment against the frozen order. The receiving wallet
      // may have another currency; its quote must be calculated by the API.
      const payment = result?.payment;
      if (!payment || (payment.orderId != null && String(payment.orderId) !== String(next.id)) || payment.currency !== next.currency || String(payment.amount) !== String(next.totalAmount)) throw new Error('El pago devuelto por la API no coincide con el pedido.');
      paymentId.current = result?.payment?.id || paymentId.current;
      if (result?.payment?.status === 'captured') {
        remember(next, true); setWatching(true); return;
      }
      const quote = readCheckout(result?.checkout);
      if (!quote) throw new Error('La API devolvió datos de Open Payments incompletos o inválidos. No abras un enlace de autorización sin una cotización válida.');
      // receive/debit belong to the provider quote and carry their own scales.
      // Do not reinterpret them with order currency defaults or calculate FX.
      setCheckout(quote); setClock(Date.now()); remember(next, renew ? false : watching);
    } catch (cause) { setError(couponMessage(cause.code, /the store has not linked a wallet to receive payments/i.test(cause.message) ? 'La tienda todavía no tiene una wallet receptora principal. Tu wallet de comprador no necesita cambios.' : cause.message)); if (cause.code?.startsWith('COUPON_')) refreshCart().catch(() => {}); }
    finally { submitting.current = false; setPending(false); }
  }
  async function renewAuthorization() {
    if (submitting.current || pending || !order) return;
    await pay(true);
  }
  function openAuthorization() {
    if (!checkout || expiry?.expired || pending) return false;
    windowFinished.current = false;
    remember(order, true); setWatching(true);
    return authorizationWindow.open(checkout.redirectUrl, order.id);
  }
  async function cancel() {
    if (pending || submitting.current || watching) return;
    setPending(true); setError(''); setPhase('Cancelando tu compra…');
    try { setOrder(unwrap(await orderService.cancel(order.id))); setWatching(false); setCheckout(null); forget(); await refreshCart(); }
    catch (cause) { setError(cause.message); } finally { setPending(false); }
  }
  const currency = order?.currency || group?.currency || 'USD';
  const amount = order ? minorToMajor(order.totalAmount, currency) : group?.total;
  const ended = order && ['cancelled', 'refunded'].includes(order.status);
  const items = order?.items?.map(item => ({ id: String(item.itemId), name: item.name, quantity: item.quantity, total: minorToMajor(item.lineAmount, currency) })) || (!order ? group?.items.map(item => ({ ...item, total: item.price * item.quantity })) : []) || [];
  return <><PageHeading eyebrow={t("PAGO EN LA TIENDA")} title={t("Revisa tu compra")} description={t("Confirma tus productos y el total antes de pagar.")} onBack={() => navigate('cart')} />
    <OrderProductList items={items} currency={currency} />
    {(order ? order.couponId != null || order.couponDiscountAmount > 0 : cartDetails?.coupon) && <CouponSummary coupon={order ? { code: order.couponCode, title: t('Descuento por cupón') } : cartDetails.coupon} currency={currency} discountAmount={minorToMajor((order ? order.couponDiscountAmount : cartDetails?.couponDiscountAmount) || 0, currency)} />}
    {!order && cartDetails?.couponError && <p className="field-error" role="alert">{t(couponMessage(cartDetails.couponError))}</p>}
    {amount != null && <div className="cart-currency-summary"><span>{t("TOTAL A PAGAR")}</span><strong>{money(amount, currency)} <small>{currency}</small></strong></div>}
    {!ended && !walletRequired && <div className="surface information-card"><b>{t('Wallet de Open Payments')}</b><p>{t('El pago utiliza la wallet principal vinculada a tu cuenta en el servidor.')}</p><Button variant="quiet" onClick={() => navigate('wallets/payment')}>{t('Mis wallets')}</Button></div>}
    {!ended && !checkout && <StoreReceivingWallet state={receiving} />}
    {error && (walletRequired ? <div className="surface checkout-wallet-alert" role="alert"><b>{t('Necesitas vincular una wallet para pagar.')}</b><p>{t('Ve a Mis wallets para agregar la dirección de tu wallet de Open Payments. Tu compra seguirá pendiente.')}</p><a className="checkout-wallet-link" href="#wallets/payment/add" onClick={event => { event.preventDefault(); navigate('wallets/payment/add'); }}>{t('Ir a Mis wallets')} →</a></div> : <p className="field-error" role="alert">{t(error)}</p>)}
    {!ended && (pending || watching) && <PaymentProgress message={pending ? phase : captureConfirmed ? 'Tu wallet confirmó el pago. Estamos actualizando el pedido…' : 'Comprobando la confirmación de tu pago…'} />}
    {!ended && checkout && <OpenPaymentsQuote checkout={checkout} expiry={expiry} watching={watching} disabled={pending} onAuthorize={openAuthorization} />}
    {!ended && checkout && expiry?.expired && <Button className="wide space-top" disabled={pending || receivingBlocked} onClick={renewAuthorization}>{t(pending ? 'Procesando…' : 'Renovar autorización')}</Button>}
    {!ended && !checkout && (!order || order.status === 'pending_payment') && <Button className="wide space-top" variant="primary" disabled={pending || watching || receivingBlocked || (!order && (cartPending || Boolean(cartDetails?.couponError) || !group || group.items.some(item => item.purchasable === false)))} onClick={() => pay(false)} aria-busy={pending || watching}>{t(pending ? 'Procesando…' : watching ? 'Pago en proceso…' : 'Pagar')}</Button>}
    {!ended && !checkout && watching && order?.status === 'pending_payment' && <Button className="wide" variant="quiet" disabled={pending || receivingBlocked} onClick={() => pay(false, true)}>{t('Recuperar enlace de autorización')}</Button>}
    {!ended && <p className="secure-note">{t('Pago con Open Payments. El cargo se autoriza en tu proveedor de wallet.')}</p>}
    {!ended && order && (watching || ['paid', 'preparing', 'completed'].includes(order.status)) && <Button className="wide" variant="secondary" disabled={pending} onClick={() => { setWatching(true); setVerification(value => value + 1); }}>{t('Comprobar pago')}</Button>}
    {order?.status === 'pending_payment' && <><p className="caption" role="status">{t(watching ? 'Esperando tu autorización y la confirmación del proveedor.' : 'Tu compra está pendiente de autorización.')}</p><Button className="wide" variant="quiet" disabled={pending || watching} onClick={cancel}>{t("Cancelar compra")}</Button></>}
    {ended && <><p role="status">El pedido está {order.status === 'cancelled' ? 'cancelado' : 'reembolsado'}.</p><Button className="wide" onClick={() => { forget(); createKey.current = orderService.newAttemptKey(); payKey.current = orderService.newAttemptKey(); setOrder(null); navigate('home/list'); }}>{t("Volver a las tiendas")}</Button></>}
    {!order && !group && !pending && <Button className="wide" onClick={() => navigate('home/list')}>{t("Agregar productos")}</Button>}
  </>;
}
