import { language } from '../../i18n/instance';
import { useTranslation } from '../../i18n/useTranslation';
import { purchaseState } from '../../lib/purchaseState';
import { money } from '../../lib/currency';
import Icon from '../ui/Icon';
import StoreLogo from '../shops/StoreLogo';

export default function PurchaseCard({ purchase, shop }) {
  const { t } = useTranslation();
  const state = purchaseState(purchase);
  const date = new Date(purchase.date);
  const name = shop?.name || t('Comercio local');
  const separateDebit = state.group === 'paid' && purchase.debit != null && purchase.debitCurrency && (purchase.debitCurrency !== purchase.currency || purchase.debit !== purchase.amount);
  return <details className={`purchase-row purchase-row--${state.tone}`}>
    <summary className="purchase-row__summary">
      <span className="purchase-row__logo">{shop ? <StoreLogo shop={shop} alt="" /> : <Icon name="shop" />}</span>
      <span className="purchase-row__merchant"><strong title={name}>{name}</strong><small>{Number.isFinite(date.getTime()) ? date.toLocaleDateString(language(), { day: 'numeric', month: 'short' }) : ''}</small></span>
      <span className="purchase-row__value"><strong>{money(purchase.amount, purchase.currency || 'COP')}</strong><span className={`purchase-row__status purchase-row__status--${state.tone}`}><Icon name={state.icon} />{t(state.label)}</span></span>
      <Icon className="purchase-row__chevron" name="chevron" />
    </summary>
    <div className="purchase-row__details"><b>{name}</b><p>{t(state.description)}</p>
      {purchase.number && <p className="purchase-row__reference">{purchase.number}</p>}
      {Number.isFinite(date.getTime()) && <small>{date.toLocaleString(language())}</small>}
      {separateDebit && <p>{t('Cargo confirmado')}: <b>{money(purchase.debit, purchase.debitCurrency)}</b></p>}
      {purchase.mode !== 'api' && <p>{t('Compra de demostración')}</p>}
      {purchase.paymentDetailsUnavailable && <p>{t('No pudimos consultar el último intento de pago. Actualiza para verificarlo.')}</p>}
    </div>
  </details>;
}
