import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../ui/Icon';
import { Button } from '../ui/Button';

export default function StoreReceivingWallet({ state }) {
  const { t } = useTranslation();
  if (state.status === 'idle') return null;
  const mismatch = state.primaryWallet && state.primaryWallet.assetCode !== state.store?.currency;
  return <section className="surface store-receiving-wallet" aria-label={t('Wallet receptora de la tienda')}>
    <div className="wallet-form-heading"><span className="wallet-icon-tile"><Icon name="shop" /></span><div><h2>{t('Wallet receptora de la tienda')}</h2><p>{state.store?.name}</p></div></div>
    {state.status === 'loading' ? <p role="status">{t('Verificando la wallet de la tienda…')}</p> : state.status === 'error' ? <p className="field-error" role="alert">{t(state.error)}</p> : state.wallet ? <p><b>{state.wallet.name}</b> · {state.wallet.assetCode}<br /><small>{t(mismatch ? 'La tienda cobra en {{storeCurrency}} y su wallet recibe {{walletCurrency}}. Al pagar, la API calculará la cotización y validará la operación.' : 'Wallet principal configurada para recibir pagos.', { storeCurrency: state.store.currency, walletCurrency: state.wallet.assetCode })}</small></p> : <p role="status">{t('Esta tienda aún no tiene una wallet principal configurada para recibir pagos. El vendedor debe asociarla antes de aceptar pagos.')}</p>}
    {(state.status === 'error' || (state.status === 'ready' && !state.wallet)) && <Button className="wide" variant="quiet" onClick={state.reload}>{t('Volver a verificar')}</Button>}
  </section>;
}
