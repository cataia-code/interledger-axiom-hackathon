import { useCallback, useEffect, useRef, useState } from 'react';
import { getMapConfig } from '../services/maps/loaders';
import { createLeafletMap } from '../services/maps/leafletAdapter';
import { createGoogleMap } from '../services/maps/googleAdapter';

export function useStoreMap({ shops, visibleIds, selectedId, onSelect, location }) {
  const containerRef = useRef(null);
  const adapterRef = useRef(null);
  const disableGoogleRef = useRef(false);
  const [status, setStatus] = useState('loading');
  const [provider, setProvider] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const onGoogleFailure = () => { disableGoogleRef.current = true; setRetryCount(current => current + 1); };
    window.addEventListener('lokora:google-auth-failure', onGoogleFailure);
    let adapter;
    const container = containerRef.current;
    setStatus('loading');
    async function initialize() {
      try {
        const config = await getMapConfig();
        if (disposed) return;
        if (config.googleMapsApiKey && !disableGoogleRef.current) {
          try { adapter = await createGoogleMap(container, shops, onSelect, config.googleMapsApiKey, controller.signal); }
          catch { if (disposed) return; container.replaceChildren(); }
        }
        if (!adapter && !disposed) adapter = await createLeafletMap(container, shops, onSelect, controller.signal);
        if (disposed) { adapter?.destroy(); return; }
        adapterRef.current = adapter;
        setProvider(adapter.provider); setStatus('ready');
      } catch { if (!disposed) setStatus('error'); }
    }
    initialize();
    return () => { disposed = true; controller.abort(); window.removeEventListener('lokora:google-auth-failure', onGoogleFailure); adapter?.destroy(); adapterRef.current = null; };
  }, [shops, onSelect, retryCount]);
  useEffect(() => { if (status === 'ready') adapterRef.current?.update(visibleIds, selectedId); }, [visibleIds, selectedId, status]);
  const center = useCallback(() => adapterRef.current?.center(), []);
  const centerOn = useCallback(location => adapterRef.current?.centerOn?.(location), []);
  useEffect(() => { if (status === 'ready') { adapterRef.current?.updateLocation?.(location); if (location) adapterRef.current?.centerOn?.(location); } }, [location, status]);
  const retry = useCallback(() => setRetryCount(current => current + 1), []);
  return { containerRef, status, provider, center, centerOn, retry };
}
