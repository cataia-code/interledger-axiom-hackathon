import { useState } from 'react';
import { useApp } from '../context/AppContext';
import PageHeading, { SectionHeading } from '../components/ui/PageHeading';
import MerchantSummary from '../components/shops/MerchantSummary';
import { Button } from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { money, toUSD } from '../lib/currency';
export default function PaymentPage() {
  const { selectedShop, navigate, amount, setAmount, confirmDemoPayment, balanceUSD } = useApp();
  const [note, setNote] = useState('');
  const insufficient = toUSD(amount) > balanceUSD;
  return <><PageHeading eyebrow="PAGO SEGURO" title="Enviar pago" description="Revisa el valor antes de confirmar." onBack={() => navigate('scanner')} />
    <MerchantSummary shop={selectedShop} /><label className="field-label" htmlFor="pay-amount">Monto de la compra · COP</label>
    <div className="payment-input"><span>$</span><input id="pay-amount" type="number" inputMode="decimal" min="1" step="100" value={amount} onChange={event => setAmount(Number(event.target.value))} /><span className="currency-badge">COP</span></div>
    <p className="conversion">Se debitarían <strong>{money(toUSD(amount), 'USD')}</strong> de tu wallet</p>
    <label className="search-field"><Icon name="note" /><input value={note} onChange={event => setNote(event.target.value)} maxLength={140} placeholder="Agregar nota (opcional)" aria-label="Nota del pago" /></label>
    <SectionHeading title="Resumen" /><div className="surface summary-box"><div><span>Monto</span><b>{money(amount)}</b></div><div><span>Comisión Lokora</span><b>{money(0)}</b></div><div className="summary-total"><span>Total a pagar</span><b>{money(amount)}</b></div><div><span>Desde tu wallet</span><b>{money(toUSD(amount), 'USD')}</b></div></div>
    {insufficient && <p className="field-error" role="alert">Saldo insuficiente. Disponible: {money(balanceUSD, 'USD')}.</p>}
    <Button className="wide" variant="wine" icon="wallet" disabled={!amount || amount < 0 || insufficient} onClick={() => confirmDemoPayment(note)}>Confirmar pago de ejemplo</Button><p className="secure-note"><Icon name="shield" />Simulación con tasa de referencia; no mueve dinero real.</p>
  </>;
}
