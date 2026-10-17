import { useTranslation } from '../../i18n/useTranslation';
import { assetMoney } from '../../lib/openPaymentsCheckout';
import { displayWalletAddress } from '../../lib/paymentWallet';
export default function OpenPaymentsQuote({ checkout, expiry, watching, onAuthorize, disabled = false }) {
  const { t } = useTranslation();
  function authorize(event) {
    if (disabled || expiry.expired) { event.preventDefault(); return; }
    // If scripted popups are blocked, the ordinary new-tab link remains usable.
    // Both routes leave Lokora open to verify the API result independently.
    if (onAuthorize()) event.preventDefault();
  }
  return <section className="surface open-payments-quote" aria-label={t('Cotización de Open Payments')}>
    <h2>{t('Paga desde tu wallet')}</h2><div className="open-payments-quote__amount"><span>{t('Tú pagas')} · {checkout.debit.currency}</span><strong>{assetMoney(checkout.debit)}</strong></div>
    <div className="open-payments-quote__amount"><span>{t('La tienda recibe')} · {checkout.receive.currency}</span><b>{assetMoney(checkout.receive)}</b></div>
    <div className="open-payments-quote__fee"><span>{t('Comisión de la red')}</span><b>{checkout.fee ? assetMoney(checkout.fee) : t('Sin desglose separado')}</b></div>
    {checkout.fee == null && <p className="caption">{t('Revisa el importe que sale de tu wallet y el que recibe la tienda. La conversión corresponde a la cotización del proveedor.')}</p>}
    <p className="caption" role="status">{expiry.expired ? t('La cotización venció. Renueva la autorización para continuar.') : t('Cotización válida por {{minutes}} min {{seconds}} s.', { minutes: expiry.minutes, seconds: String(expiry.seconds).padStart(2, '0') })}</p>
    {checkout.buyerWallet && <p className="saved-wallet-address"><b>{t('Wallet para este pago')}</b><br />{displayWalletAddress(checkout.buyerWallet)}</p>}
    {!expiry.expired && <a className={`button button--primary wide ${disabled ? 'is-disabled' : ''}`} href={disabled ? undefined : checkout.redirectUrl} target="_blank" rel="noopener noreferrer" aria-disabled={disabled} onClick={authorize}>{t(watching ? 'Volver a mi wallet' : 'Autorizar en mi wallet')}</a>}
    <small>{t('La autorización se abre en otra ventana. Lokora comprobará el resultado y tratará de cerrarla al terminar. Si permanece abierta, vuelve a esta pestaña.')}</small>
  </section>;
}
