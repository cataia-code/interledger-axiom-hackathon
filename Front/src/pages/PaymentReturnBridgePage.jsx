import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import BrandLogo from '../components/layout/BrandLogo';
import PaymentReturnCountdown from '../components/payments/PaymentReturnCountdown';
import { Button } from '../components/ui/Button';
import { useTranslation } from '../i18n/useTranslation';
import { PAYMENT_POPUP_KEY, PAYMENT_RETURN_CHANNEL, paymentReturnPath } from '../lib/paymentReturnBridge';
const RETURN_DELAY_MS = 3000;

export function showPaymentReturnBridge(orderId) {
  createRoot(document.getElementById('root')).render(<PaymentReturnBridgePage orderId={orderId} />);
}
function readPopupMarker(orderId) {
  try {
    const marker = JSON.parse(sessionStorage.getItem(PAYMENT_POPUP_KEY) || 'null');
    return String(marker?.orderId) === String(orderId) && Date.now() - marker.createdAt < 10 * 60 * 1000;
  } catch { return false; }
}
function PaymentReturnBridgePage({ orderId }) {
  const { t } = useTranslation();
  const [fallback, setFallback] = useState(false);
  const [remainingMs, setRemainingMs] = useState(RETURN_DELAY_MS);
  useEffect(() => {
    const marker = readPopupMarker(orderId);
    let finished = false;
    let acknowledged = false;
    const nonce = crypto.randomUUID();
    let channel;
    let timer;
    try {
      channel = new BroadcastChannel(PAYMENT_RETURN_CHANNEL);
      channel.onmessage = event => {
        if (event.data?.type !== 'ack' || event.data.nonce !== nonce || String(event.data.orderId) !== String(orderId)) return;
        acknowledged = true;
      };
    } catch { channel = null; }
    function finish() {
      if (finished) return;
      finished = true;
      setRemainingMs(0);
      channel?.close();
      clearTimeout(timer);
      if (marker || acknowledged) {
        try { window.close(); } catch { /* Browser may require manual closing. */ }
        setFallback(true);
      } else {
        // Same-tab callback: reuse this authenticated tab and remove the raw
        // query before app initialization. The destination verifies via API.
        window.location.replace(paymentReturnPath(orderId));
      }
    }
    if (!channel) { finish(); return () => {}; }
    const started = Date.now();
    function announce() {
      if (finished) return;
      setRemainingMs(Math.max(0, RETURN_DELAY_MS - (Date.now() - started)));
      channel.postMessage({ type: 'return', orderId: String(orderId), nonce });
      if (acknowledged || Date.now() - started >= RETURN_DELAY_MS) { finish(); return; }
      timer = setTimeout(announce, 150);
    }
    announce();
    return () => { finished = true; channel?.close(); clearTimeout(timer); };
  }, [orderId]);
  return <main className="payment-return-bridge"><BrandLogo /><PaymentReturnCountdown remainingMs={remainingMs} totalMs={RETURN_DELAY_MS} fallback={fallback} />
    {fallback && <div className="surface information-card"><p>{t('Tu pago volverá a Lokora para ser verificado. Si la ventana no se cierra, ciérrala para volver a la app.')}</p><Button className="wide" onClick={() => window.close()}>{t('Cerrar ventana y volver a Lokora')}</Button><Button className="wide space-top" variant="quiet" onClick={() => window.location.replace(paymentReturnPath(orderId))}>{t('Continuar aquí y verificar el pedido')}</Button></div>}
  </main>;
}
