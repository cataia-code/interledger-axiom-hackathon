import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { paymentService } from '../../services/payments/paymentService';
import { DATA_SOURCE } from '../../services/api/client';
import { normalizeWalletAddress, displayWalletAddress } from '../../lib/paymentWallet';
import { Button } from '../ui/Button';
import Icon from '../ui/Icon';
export default function PaymentWallet() {
  const { user, refreshSession, openAccount, paymentPending } = useApp();
  const [address, setAddress] = useState(displayWalletAddress(user?.paymentWallet?.address));
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function connect(value) {
    setError(''); setPending(true);
    try { await paymentService.connectPaymentWallet({ address: normalizeWalletAddress(value) }); await refreshSession(); setEditing(false); }
    catch (cause) { setError(cause.message); } finally { setPending(false); }
  }
  if (!user) return <section className="surface payment-wallet"><h2>Wallet compatible con Open Payments</h2><p>Inicia sesión para conectar una wallet de un proveedor compatible con Open Payments y pagar en dólares.</p><Button className="wide" onClick={() => openAccount('buy', 'payment')}>Iniciar sesión para continuar</Button></section>;
  return <section className="surface payment-wallet"><header><Icon name="wallet" /><div><h2>Wallet compatible con Open Payments</h2><small>Fondos en USD · proveedor compatible</small></div></header>
    {user.paymentWallet && !editing ? <><p className="wallet-address">{displayWalletAddress(user.paymentWallet.address)}</p><p>El pago se autoriza con tu proveedor. Tu saldo permanece en tu wallet.</p><Button variant="quiet" disabled={paymentPending} onClick={() => setEditing(true)}>Cambiar wallet</Button></> : <><form onSubmit={event => { event.preventDefault(); connect(address); }}><label htmlFor="payment-wallet-address">Dirección de tu wallet compatible con Open Payments<input id="payment-wallet-address" type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby="payment-wallet-help" placeholder="$ilp.interledger-test.dev/tu-wallet" value={address} onChange={event => setAddress(event.target.value)} required disabled={pending} /></label><p id="payment-wallet-help">Usa el Payment Pointer que empieza por $ o su dirección HTTPS.</p><Button className="wide" type="submit" disabled={pending || paymentPending}>{pending ? 'Conectando…' : 'Conectar wallet'}</Button></form>{DATA_SOURCE === 'mock' && <Button className="wide" variant="quiet" disabled={pending || paymentPending} onClick={() => connect('https://wallet.example/viajero-usd')}>Usar wallet USD de ejemplo</Button>}</>}
    {error && <p className="field-error" role="alert">{error}</p>}{DATA_SOURCE === 'mock' && <small className="payment-demo-label">Wallet de demostración: no se contacta un proveedor ni se comprueba su compatibilidad.</small>}
  </section>;
}
