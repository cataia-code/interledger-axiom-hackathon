import { useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { displayWalletAddress } from '../../lib/paymentWallet';
import Icon from '../ui/Icon';
import { Button } from '../ui/Button';

export default function SavedWalletCard({ wallet, onPrefer, onRemove, disabled = false }) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  return <article className={`surface saved-wallet-card ${wallet.preferred ? 'saved-wallet-card--preferred' : ''}`}>
    <div className="saved-wallet-card__heading"><span className="wallet-icon-tile"><Icon name="wallet" /></span><h2>{wallet.name}</h2>{wallet.preferred && <span className="saved-wallet-badge"><Icon name="star" />{t(wallet.source === 'api' ? 'Principal' : 'Preferida')}</span>}</div>
    <p className="saved-wallet-address">{displayWalletAddress(wallet.address)}</p>
    <small>{wallet.source === 'api' ? <>{t('Asociada a tu cuenta')}{wallet.currency && ` · ${wallet.currency}`}</> : t('Vinculación pendiente')}</small>
    {confirming ? <div role="group" aria-label={t('Eliminar wallet')}><p>{t('¿Eliminar esta dirección de tus wallets guardadas?')}</p><div className="saved-wallet-actions"><Button variant="secondary" disabled={disabled} onClick={onRemove}>{t('Eliminar')}</Button><Button variant="quiet" disabled={disabled} onClick={() => setConfirming(false)}>{t('Cancelar')}</Button></div></div> : (onPrefer || onRemove) && <div className="saved-wallet-actions">{!wallet.preferred && onPrefer && <Button variant="quiet" disabled={disabled} onClick={onPrefer}>{t('Marcar preferida')}</Button>}{onRemove && <Button variant="quiet" disabled={disabled} onClick={() => setConfirming(true)}>{t('Eliminar')}</Button>}</div>}
  </article>;
}
