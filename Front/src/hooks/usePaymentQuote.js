import { useEffect, useState } from 'react';
import { paymentService } from '../services/payments/paymentService';
export function usePaymentQuote(shopId, items, walletAddress, userId) {
  const [state, setState] = useState({ quote: null, pending: false, error: '', key: null });
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify({ shopId, items, walletAddress, userId });
  useEffect(() => {
    let active = true;
    if (!shopId || !items.length || !walletAddress || !userId) { setState({ quote: null, pending: false, error: '', key }); return; }
    setState({ quote: null, pending: true, error: '', key });
    paymentService.createPaymentQuote({ shopId, items }).then(quote => { if (active) setState({ quote, pending: false, error: '', key }); }).catch(error => { if (active) setState({ quote: null, pending: false, error: error.message, key }); });
    return () => { active = false; };
  }, [key, revision]);
  return { ...(state.key === key ? state : { quote: null, pending: Boolean(walletAddress && userId && items.length), error: '' }), refresh: () => setRevision(value => value + 1) };
}
