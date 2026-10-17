import { useTranslation } from '../i18n/useTranslation';
import { useApp } from '../context/AppContext';
import { money } from '../lib/currency';
import { Button } from '../components/ui/Button';
import Icon from '../components/ui/Icon';
export default function PaymentSuccessPage() {
  const { t } = useTranslation();
  const { navigate, lastPayment, selectedShop, findShop: getShop } = useApp();
  const payment = lastPayment;
  const shop = payment ? getShop(payment.shopId) : selectedShop;
  return <section className="payment-success"><span className="success-check"><Icon name="check" /></span><span className="eyebrow">{t("GRACIAS POR COMPRAR LOCAL")}</span><h1>{t(payment ? payment.mode === 'api' ? '¡Pago confirmado!' : '¡Pago de ejemplo enviado!' : 'Tu compra, más cerca.')}</h1><p>{payment ? t('Tu compra apoya a {{name}}.', {name:shop?.name || t('el comercio local')}) : t('Explora tiendas y descubre productos locales.')}</p>
    {payment?.mode === 'api' && payment.status === 'captured' && <div className="payment-accepted" role="status"><Icon name="shield" /><div><b>{t('Autorización aceptada y pago confirmado')}</b><small>{t('El proveedor confirmó el débito desde tu wallet.')}</small></div></div>}
    {payment && <div className="surface summary-box"><div><span>{t("Comercio")}</span><b>{(shop?.name || 'el comercio local')}</b></div><div><span>{t('La tienda recibe · {{currency}}', {currency:payment.currency || 'COP'})}</span><b>{money(payment.amount, payment.currency || 'COP')}</b></div>{payment.debit != null && <div><span>{t('Pagaste desde tu wallet · {{currency}}', { currency: payment.debitCurrency || 'USD' })}</span><b>{money(payment.debit, payment.debitCurrency || 'USD')}</b></div>}{payment.hasQuote && <div><span>{t('Comisión')}</span><b>{payment.fee == null ? t('Sin desglose separado') : money(payment.fee, payment.feeCurrency)}</b></div>}</div>}
    {payment?.mode === 'api' && <p className="caption">{t('Si la ventana de tu wallet sigue abierta, puedes cerrarla. El resultado confirmado ya está aquí.')}</p>}
    <Button className="wide" icon="arrowRight" onClick={() => navigate('map')}>{t("Seguir explorando")}</Button><Button variant="quiet" onClick={() => navigate('wallet')}>{t("Ver mis compras")}</Button>
  </section>;
}
