import { useApp } from '../context/AppContext';
import { useCamera } from '../hooks/useCamera';
import { Button, IconButton } from '../components/ui/Button';
import QRDemo from '../components/ui/QRDemo';
export default function ScannerPage() {
  const { navigate, selectedShop } = useApp();
  const { videoRef, active, error, start, toggleTorch } = useCamera();
  return <section className="scanner"><div className="scanner__top"><IconButton icon="arrowLeft" label="Volver al mapa" onClick={() => navigate('map')} /><IconButton icon="flash" label="Activar linterna" onClick={toggleTorch} /></div>
    <span className="eyebrow">PAGA EN {selectedShop.name.toUpperCase()}</span><h1>{active ? 'Alinea el QR dentro del marco' : <>Escanea el código QR<br />de la tienda</>}</h1>
    <div className="scan-frame">{!active && <QRDemo />}<video ref={videoRef} autoPlay playsInline muted className={active ? '' : 'visually-hidden'} /><div className="scan-laser" /></div>
    <p className="scanner__hint" role="status">{error || (active ? 'Cámara activa. Puedes continuar ingresando el monto.' : 'QR de muestra · ingresa el monto para probar el pago.')}</p>
    <div className="scanner__actions"><Button variant="secondary" icon="qr" onClick={start}>{active ? 'Cámara activa' : 'Activar cámara'}</Button><Button icon="arrowRight" onClick={() => navigate('payment')}>Ingresar monto</Button></div>
  </section>;
}
