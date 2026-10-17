import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useTranslation } from '../i18n/useTranslation';
import { orderService } from '../services/orders/orderService';
import { confirmedOrderPayment } from '../lib/paymentStatus';
import PageHeading from '../components/ui/PageHeading';
import { Button } from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import PaymentProgress from '../components/payments/PaymentProgress';

export default function PaymentReturnPage() {
  const { param, user, navigate, refreshCart, completeApiPayment } = useApp();
  const { t } = useTranslation();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ status: 'checking', message: '' });
  useEffect(() => {
    let active = true; let timer;
    const started = Date.now();
    setState({ status: 'checking', message: '' });
    if (!/^\d+$/.test(param || '')) { setState({ status: 'error', message: 'No pudimos identificar el pedido que quieres comprobar.' }); return; }
    async function check() {
      try {
        // URL parameters are navigation hints, never proof of authorization.
        const [orderResult, paymentResult] = await Promise.all([orderService.get(param), orderService.payments(param)]);
        if (!active) return;
        const order = orderResult.order || orderResult;
        const payments = paymentResult.payments || [];
        const captured = confirmedOrderPayment(order, payments);
        if (captured) {
          try {
            const key = `lokora:checkout:${user.id}`;
            const attempt = JSON.parse(sessionStorage.getItem(key) || 'null');
            if (String(attempt?.orderId) === String(order.id)) sessionStorage.removeItem(key);
          } catch { /* The API, not storage, determines success. */ }
          refreshCart().catch(() => {}); completeApiPayment(order, null, captured); return;
        }
        if (['cancelled', 'refunded', 'expired'].includes(order.status)) { setState({ status: 'stopped', message: 'Este pedido fue cancelado, reembolsado o su plazo terminó. Revisa su estado en Mis compras.' }); return; }
        const latest = [...payments].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || Number(b.id) - Number(a.id))[0];
        if (latest && ['failed', 'cancelled', 'rejected', 'denied'].includes(latest.status)) { setState({ status: 'stopped', message: 'La autorización fue rechazada o no se completó. El pago no figura como confirmado.' }); return; }
        if (Date.now() - started >= 120000) { setState({ status: 'pending', message: 'Todavía esperamos confirmación del proveedor. Puedes volver a comprobar el estado o revisar Mis compras.' }); return; }
        timer = setTimeout(check, 4000);
      } catch (cause) { if (active) setState({ status: 'error', message: cause.message }); }
    }
    check();
    return () => { active = false; clearTimeout(timer); };
  }, [param, user.id, revision]);
  return <><PageHeading eyebrow="OPEN PAYMENTS" title={t('De vuelta en Lokora')} description={t('Estamos verificando el resultado de tu autorización.')} />
    {state.status === 'checking' ? <PaymentProgress message="Comprobando la confirmación de tu pago…" /> : <div className="surface information-card" role="status"><Icon name="info" /><p>{t(state.message)}</p></div>}
    {state.status !== 'checking' && <Button className="wide space-top" onClick={() => setRevision(value => value + 1)}>{t('Comprobar de nuevo')}</Button>}
    <Button className="wide space-top" variant="secondary" icon="receipt" onClick={() => navigate('wallet')}>{t('Mis compras')}</Button>
    <Button className="wide" variant="quiet" onClick={() => navigate('payment')}>{t('Volver al pago')}</Button>
  </>;
}
