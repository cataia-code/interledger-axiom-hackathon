import { useState } from 'react';
import { useApp } from '../context/AppContext';
import PageHeading, { SectionHeading } from '../components/ui/PageHeading';
import { Button } from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { money, REFERENCE_RATE, toUSD } from '../lib/currency';
import { getShop } from '../data/shops';
export default function WalletPage() {
  const { navigate, balanceUSD, payments } = useApp();
  const [amount, setAmount] = useState(85000);
  return <><PageHeading eyebrow="PAGA EN TU MONEDA" title="Mi wallet" description="Tu saldo para comprar local." onBack={() => navigate('profile')} />
    <article className="wallet-card"><Icon name="wallet" /><small>SALDO DISPONIBLE</small><strong>{money(balanceUSD, 'USD')}</strong><span>•••• &nbsp; •••• &nbsp; •••• &nbsp; 2048</span><small>Wallet de demostración</small></article>
    <SectionHeading title="Previsualiza tu compra" /><div className="surface wallet-convert"><label htmlFor="wallet-amount">Valor de la compra en pesos</label><div className="currency-input"><input id="wallet-amount" type="number" min="0" value={amount} onChange={event => setAmount(Number(event.target.value))} /><b>COP</b></div>
      <p className="conversion">Se debitarían <strong>{money(toUSD(amount), 'USD')}</strong></p><small>Tasa de ejemplo: 1 USD = {money(REFERENCE_RATE)}</small><Button className="wide" icon="arrowRight" onClick={() => navigate('map')}>Explorar tiendas</Button>
    </div><SectionHeading title="Movimientos recientes" /><div className="surface transaction-list">{payments.length ? payments.map((payment, index) => <div className="setting-row" key={`${payment.date}-${index}`}><span>{getShop(payment.shopId).name}<small>Compra de demostración</small></span><b>−{money(payment.debit, 'USD')}</b></div>) : <><div className="setting-row"><span>Café Ancestral<small>Ejemplo · Hoy</small></span><b>−US$ 8,00</b></div><div className="setting-row"><span>Artesanías Bacatá<small>Ejemplo · Ayer</small></span><b>−US$ 35,00</b></div></>}</div>
  </>;
}
