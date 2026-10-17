import { useEffect, useRef, useState } from 'react';
export function useDeviceLocation() {
  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const requestId = useRef(0);
  useEffect(() => () => { requestId.current += 1; }, []);
  function requestLocation() {
    const id = ++requestId.current;
    setLocation(null); setError('');
    if (!window.isSecureContext || !navigator.geolocation) {
      setStatus('error'); setError('La ubicación necesita HTTPS o localhost y un navegador compatible.'); return;
    }
    setStatus('loading');
    navigator.geolocation.getCurrentPosition(position => {
      if (id !== requestId.current) return;
      setLocation({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: position.timestamp });
      setStatus('ready');
    }, failure => {
      if (id !== requestId.current) return;
      setStatus('error');
      setError(({ 1: 'No autorizaste la ubicación. Puedes habilitarla desde los permisos de tu navegador.', 2: 'No pudimos obtener tu ubicación. Intenta desde un lugar con mejor señal.', 3: 'La solicitud tardó demasiado. Puedes intentar de nuevo.' })[failure.code] || 'No pudimos consultar tu ubicación.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }
  return { location, status, error, requestLocation };
}
