import { useCallback, useRef } from 'react';
import { PAYMENT_POPUP_KEY } from '../lib/paymentReturnBridge';

export function usePaymentWindow() {
  const popup = useRef(null);
  const open = useCallback((url, orderId) => {
    try {
      if (popup.current && !popup.current.closed) { popup.current.focus(); return true; }
      // Create a same-origin blank window synchronously on the user's click,
      // retain its handle, then isolate the provider before navigating away.
      const child = window.open('about:blank', '_blank', 'popup=yes,width=480,height=760');
      if (!child) return false;
      try {
        child.sessionStorage.setItem(PAYMENT_POPUP_KEY, JSON.stringify({ orderId: String(orderId), createdAt: Date.now() }));
        child.opener = null; child.location.replace(url); popup.current = child;
      }
      catch { child.close(); return false; }
      return true;
    } catch { return false; }
  }, []);
  const close = useCallback(() => {
    try { if (popup.current && !popup.current.closed) popup.current.close(); } catch { /* Provider policies may sever the window handle. */ }
    popup.current = null;
    try { window.focus(); } catch { /* Some browsers require a user gesture to focus. */ }
  }, []);
  return { open, close };
}
