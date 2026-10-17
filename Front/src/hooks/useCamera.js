import { useCallback, useEffect, useRef, useState } from 'react';

export function useCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const requestId = useRef(0);
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const stop = useCallback(() => {
    requestId.current += 1;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }, []);
  useEffect(() => () => stop(), [stop]);
  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) { setError('La cámara no está disponible. Puedes ingresar el monto.'); return; }
    const id = ++requestId.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (id !== requestId.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setError(''); setActive(true);
    } catch { setError('No pudimos acceder a la cámara. Revisa el permiso o ingresa el monto.'); }
  }
  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track?.getCapabilities?.().torch) { setError('La linterna no está disponible en esta cámara.'); return; }
    try { await track.applyConstraints({ advanced: [{ torch: !track.getSettings().torch }] }); }
    catch { setError('No pudimos activar la linterna de esta cámara.'); }
  }
  return { videoRef, active, error, start, stop, toggleTorch };
}
