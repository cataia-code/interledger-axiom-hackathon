import { useApp } from '../context/AppContext';
import { getShop } from '../data/shops';
import { money } from '../lib/currency';
import { Button } from '../components/ui/Button';
import Icon from '../components/ui/Icon';
export default function PaymentSuccessPage() {
  const { navigate, payments, selectedShop } = useApp();
  const payment = payments[0];
  const shop = payment ? getShop(payment.shopId) : selectedShop;
  return <section className="payment-success"><span className="success-check"><Icon name="check" /></span><span className="eyebrow">GRACIAS POR COMPRAR LOCAL</span><h1>{payment ? '¡Pago de ejemplo enviado!' : 'Tu compra, más cerca.'}</h1><p>{payment ? `Tu compra apoya a ${shop.name}.` : 'Explora tiendas y descubre productos locales.'}</p>
    {payment && <div className="surface summary-box"><div><span>Comercio</span><b>{shop.name}</b></div><div><span>Compra</span><b>{money(payment.amount)}</b></div><div><span>Débito en tu wallet</span><b>{money(payment.debit, 'USD')}</b></div></div>}
    <Button className="wide" icon="arrowRight" onClick={() => navigate('map')}>Seguir explorando</Button><Button variant="quiet" onClick={() => navigate('wallet')}>Ver mi wallet</Button>
  </section>;
}
