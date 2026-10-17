import { language } from '../i18n/instance';
import { useTranslation } from '../i18n/useTranslation';
import ApiCheckoutPage from './ApiCheckoutPage';
import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { usePaymentQuote } from '../hooks/usePaymentQuote';
import PageHeading from '../components/ui/PageHeading';
import MerchantSummary from '../components/shops/MerchantSummary';
import OrderProductList from '../components/cart/OrderProductList';
import PaymentWallet from '../components/payments/PaymentWallet';
import { Button } from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { money, toUSD, REFERENCE_RATE } from '../lib/currency';
import { DATA_SOURCE } from '../services/api/client';
export default function PaymentPage() {
  const { t } = useTranslation(); return DATA_SOURCE === 'api' ? <ApiCheckoutPage /> : <MockPaymentPage />; }
function MockPaymentPage() {
  const { t } = useTranslation();
  const { findShop, navigate, confirmDemoPayment, checkoutShopId, cartGroups, paymentPending, user } = useApp();
  const [note, setNote] = useState('');
  const [now, setNow] = useState(Date.now());
  const group = cartGroups.find(group => group.shopId === checkoutShopId);
  const shop = findShop(checkoutShopId);
  const items = group?.items.map(item => ({ productId: item.id, quantity: item.quantity })) || [];
  const { quote, pending, error, refresh } = usePaymentQuote(checkoutShopId, items, user?.paymentWallet?.address, user?.id);
  useEffect(() => { setNow(Date.now()); if (!quote) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [quote?.id]);
  const expired = quote && Date.parse(quote.expiresAt) <= now;
  if (!checkoutShopId || !group || !shop) return <><PageHeading title={t("Revisa tu carrito")} description={t("Selecciona una tienda y pulsa Ir a pagar para continuar.")} /><Button className="wide" icon="cart" onClick={() => navigate('cart')}>{t("Ver carrito completo")}</Button></>;
  const receive = quote?.receiveAmount ?? group.total;
  const debit = quote?.debitAmount ?? toUSD(group.total);
  const rate = quote?.rate ?? REFERENCE_RATE;
  return <><PageHeading eyebrow={t("PAGA EN TU MONEDA")} title={t("Revisa tu compra")} description={t("Desde tu wallet en dólares, directo al comercio local.")} onBack={() => navigate('cart')} />
    <MerchantSummary shop={shop} /><div className="payment-flow"><div><span>{t("TÚ PAGAS")}</span><strong>{money(debit, 'USD')}</strong><b>{t("USD · desde tu wallet")}</b></div><Icon name="arrowRight" /><div><span>{t("LA TIENDA RECIBE")}</span><strong>{money(receive)}</strong><b>{t("COP · pesos colombianos")}</b></div></div>
    <p className="payment-rate">{quote ? 'Cotización' : 'Estimación'} · 1 USD = {money(rate)} COP{DATA_SOURCE === 'mock' ? ' · Tasa de ejemplo' : ''}</p>
    <OrderProductList currency="COP" items={group.items.map(item => ({ ...item, total: item.price * item.quantity }))} />
    <PaymentWallet key={user?.id || 'visitor'} />
    <label className="search-field"><Icon name="note" /><input value={note} onChange={event => setNote(event.target.value)} disabled={paymentPending} maxLength={140} placeholder={t("Agregar nota (opcional)")} aria-label={t("Nota del pago")} /></label>
    <div className="payment-quote-status" role="status">{pending ? <p>{t("Solicitando cotización…")}</p> : error ? <p className="field-error">{error}</p> : expired ? <p>{t("La cotización venció. Actualízala para continuar.")}</p> : quote ? <p>Cotización válida hasta {new Date(quote.expiresAt).toLocaleTimeString(language(), { hour: '2-digit', minute: '2-digit' })}. Comisión{DATA_SOURCE === 'mock' ? ' de ejemplo' : ''}: {money(quote.feeAmount, 'USD')} USD.</p> : <p>{t("Conecta tu wallet para obtener la cotización antes de confirmar.")}</p>}{(error || expired) && <Button variant="secondary" disabled={pending || paymentPending} onClick={refresh}>{t("Actualizar cotización")}</Button>}</div>
    <Button className="wide" variant="wine" icon="arrowRight" disabled={paymentPending || pending || !quote || Boolean(expired)} onClick={() => confirmDemoPayment(note, quote)}>{paymentPending ? 'Procesando…' : DATA_SOURCE === 'mock' ? `Simular pago de ${money(debit, 'USD')} USD` : `Autorizar ${money(debit, 'USD')} USD en mi wallet`}</Button>
    <p className="secure-note"><Icon name="shield" />{DATA_SOURCE === 'mock' ? 'Demostración del flujo previsto con Open Payments. No mueve dinero real.' : 'Autoriza el pago con tu proveedor. Lokora no mantiene tus fondos.'}</p>
    <Button className="wide" variant="quiet" icon="qr" onClick={() => navigate('scanner')}>{t("Ver QR y cercanía a la tienda")}</Button>
  </>;
}
