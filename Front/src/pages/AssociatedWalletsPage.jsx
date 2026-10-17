import { useEffect, useRef, useState } from 'react';
import { DATA_SOURCE } from '../services/api/client';
import { useApp } from '../context/AppContext';
import { useTranslation } from '../i18n/useTranslation';
import { useStoreReceivingWallet } from '../hooks/useStoreReceivingWallet';
import StoreReceivingWallet from '../components/payments/StoreReceivingWallet';
import { savedWalletService } from '../services/payments/savedWalletService';
import SavedWalletCard from '../components/payments/SavedWalletCard';
import WalletIllustration from '../components/payments/WalletIllustration';
import Icon from '../components/ui/Icon';
import PageHeading from '../components/ui/PageHeading';
import { Button } from '../components/ui/Button';

export default function AssociatedWalletsPage() {
  const { user, ownedShop, navigate, param, path } = useApp();
  const receiving = useStoreReceivingWallet(user.role === 'seller' && ownedShop?.id != null ? String(ownedShop.id) : null);
  return <WalletAddressBook receiving={receiving} key={`${user.id}:${path}`} userId={user.id} startAdding={path === 'wallets/payment/add'} seller={user.role === 'seller'} storeCurrency={ownedShop?.currency} fromPayment={param === 'payment'} onBack={() => navigate(param === 'payment' ? 'payment' : 'profile')} />;
}
function WalletAddressBook({ userId, onBack, startAdding, fromPayment, seller, storeCurrency, receiving }) {
  const { t } = useTranslation();
  const api = DATA_SOURCE === 'api';
  const [wallets, setWallets] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const active = useRef(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    setLoading(true); setError('');
    Promise.resolve().then(() => savedWalletService.list(userId, { signal: controller.signal }))
      .then(result => { if (current) setWallets(result); })
      .catch(cause => { if (current && cause.name !== 'AbortError') setError(cause.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [userId, revision]);
  const [status, setStatus] = useState('');
  const [adding, setAdding] = useState(startAdding);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  async function update(action, message, afterSave) {
    if (busy.current || loading) return;
    busy.current = true; setPending(true); setError(''); setStatus('');
    try {
      await action();
      if (!active.current) return;
      setStatus(message); afterSave?.();
      // Refresh from the server after saving. If refresh fails, keep the save
      // confirmation so that the user does not repeat a successful POST.
      try {
        const result = await savedWalletService.list(userId);
        if (active.current) setWallets(result);
      } catch { if (active.current) setError('Los cambios se guardaron, pero no pudimos actualizar la lista. Pulsa Recargar wallets.'); }
    } catch (cause) {
      if (active.current) setError(cause.name === 'QuotaExceededError' || cause.name === 'SecurityError' ? 'No pudimos guardar los cambios en este dispositivo.' : cause.message);
    } finally { busy.current = false; if (active.current) setPending(false); }
  }
  function add(event) {
    event.preventDefault();
    update(() => savedWalletService.add(userId, { name, address }), api ? 'Wallet asociada a tu cuenta.' : 'Dirección guardada en este dispositivo.', () => { setName(''); setAddress(''); setAdding(false); });
  }
  return <><PageHeading eyebrow="OPEN PAYMENTS" title={t('Mis wallets')} description={t('Guarda las direcciones de tus wallets en un solo lugar.')} onBack={onBack} />
    <section className="wallet-collection-hero" aria-label={t('Tus wallets, contigo')}><div><span className="wallet-collection-hero__label">OPEN PAYMENTS</span><h2>{t('Tus wallets, contigo')}</h2><p>{t('Una dirección. Más posibilidades.')}</p><span className="wallet-collection-hero__privacy"><Icon name="shield" />{t('Tu saldo permanece en tu wallet')}</span></div><WalletIllustration /></section>
    <aside className="wallet-local-notice"><Icon name={api ? 'shield' : 'info'} /><div>{api ? <><b>{t('Wallets asociadas a tu cuenta')}</b><p>{t(seller ? 'Open Payments calcula la conversión entre la moneda de compra y la wallet receptora.' : 'Tu wallet principal se utiliza para pagar. La autorización del débito se hace con tu proveedor.')}</p>{seller && storeCurrency && <p><b>{t('Moneda de tu tienda')}: {storeCurrency}</b></p>}</> : <><b>{t('Guardadas en este dispositivo')}</b><details><summary>{t('Vinculación pendiente · Ver detalles')}</summary><p>{t('Estas direcciones todavía no están vinculadas a tu cuenta en el servidor. Elegir una preferida aquí no cambia la wallet usada al pagar.')}</p><small>{t('Lokora no consulta ni muestra tu saldo.')}</small></details></>}</div></aside>
    {seller && <StoreReceivingWallet state={receiving} />}
    {seller && <p className="caption">{t('Las wallets de tu cuenta y las receptoras de tu tienda son independientes. El estado de recepción se consulta en la tienda.')}</p>}
    {loading && <p className="caption" role="status">{t('Cargando wallets…')}</p>}
    <div className="saved-wallet-list" aria-busy={loading || pending}>{wallets.map(wallet => <SavedWalletCard key={wallet.id} wallet={wallet} disabled={pending || loading} onPrefer={api ? undefined : () => update(() => savedWalletService.prefer(userId, wallet.id), 'Wallet preferida actualizada en este dispositivo.')} onRemove={api ? undefined : () => update(() => savedWalletService.remove(userId, wallet.id), 'Dirección eliminada de este dispositivo.')} />)}</div>
    {!loading && !error && !wallets.length && !adding && <div className="wallet-empty"><span className="wallet-icon-tile"><Icon name="wallet" /></span><h2>{t('Tu primera wallet empieza aquí')}</h2><p>{t('Aún no has guardado wallets. Agrega la dirección que te entrega tu proveedor.')}</p></div>}
    {error && <p className="field-error" role="alert">{t(error)}</p>}
    {error && <Button className="wide" variant="quiet" disabled={pending || loading} onClick={() => setRevision(value => value + 1)}>{t('Recargar wallets')}</Button>}
    <p className="caption" role="status">{t(status)}</p>
    {adding ? <form className="surface saved-wallet-form" onSubmit={add}><fieldset className="saved-wallet-fields" disabled={loading || pending}><div className="wallet-form-heading"><span className="wallet-icon-tile"><Icon name="wallet" /></span><div><h2>{t('Agregar wallet')}</h2><p>{t('Dale un nombre y guarda su dirección.')}</p></div></div>
      <label htmlFor="saved-wallet-name">{t('Nombre de la wallet')}<input id="saved-wallet-name" value={name} onChange={event => setName(event.target.value)} maxLength={60} required placeholder={t('Ej. Mi wallet de viaje')} autoFocus /></label>
      <label htmlFor="saved-wallet-address">{t('Dirección de tu wallet de Open Payments')}<input id="saved-wallet-address" type="text" value={address} onChange={event => setAddress(event.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} required placeholder="$ilp.interledger-test.dev/tu-wallet" aria-describedby="saved-wallet-help" /></label>
      <p id="saved-wallet-help" className="caption">{t('Pega el Payment Pointer que empieza por $ o la dirección HTTPS de tu wallet. No ingreses contraseñas ni enlaces de autorización.')}</p>
      <Button className="wide" type="submit" icon="wallet">{t(pending ? 'Guardando…' : api ? 'Asociar wallet' : 'Guardar dirección')}</Button><Button className="wide" variant="quiet" type="button" onClick={() => { setAdding(false); setName(''); setAddress(''); setError(''); }}>{t('Cancelar')}</Button>
    </fieldset></form> : <Button className="wide space-top" disabled={loading || pending} icon="plus" onClick={() => { setAdding(true); setStatus(''); }}>{t('Agregar wallet')}</Button>}
    {fromPayment && <Button className="wide space-top" variant="secondary" onClick={onBack}>{t('Volver al pago')}</Button>}
  </>;
}
