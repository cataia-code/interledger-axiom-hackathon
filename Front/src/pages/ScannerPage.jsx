import { useTranslation } from '../i18n/useTranslation';
import { useApp } from '../context/AppContext';
import { useCamera } from '../hooks/useCamera';
import { Button, IconButton } from '../components/ui/Button';
import StorePresence from '../components/location/StorePresence';
import QRDemo from '../components/ui/QRDemo';
export default function ScannerPage() {
  const { t } = useTranslation();
  const { navigate, findShop, checkoutShopId } = useApp();
  const selectedShop = findShop(checkoutShopId);
  const { videoRef, active, error, start, toggleTorch } = useCamera();
  if (!checkoutShopId) return <section className="scanner"><h1>{t("Comienza desde la tienda")}</h1><p>{t("Elige productos del catálogo para iniciar tu compra.")}</p><Button onClick={() => navigate('home/list')}>{t("Ver tiendas")}</Button></section>;
  return <section className="scanner"><div className="scanner__top"><IconButton icon="arrowLeft" label={t("Volver al mapa")} onClick={() => navigate('map')} /><IconButton icon="flash" label={t("Activar linterna")} onClick={toggleTorch} /></div>
    <span className="eyebrow">PAGA EN {(selectedShop?.name || 'TU COMERCIO').toUpperCase()}</span><h1>{active ? 'Alinea el QR dentro del marco' : <>{t("Escanea el código QR")}<br />{t("de la tienda")}</>}</h1>
    <div className="scan-frame">{!active && <QRDemo />}<video ref={videoRef} autoPlay playsInline muted className={active ? '' : 'visually-hidden'} /><div className="scan-laser" /></div>
    <p className="scanner__hint" role="status">{error || (active ? 'Cámara activa. Puedes continuar revisando la compra.' : 'QR de muestra · revisa tu compra para probar el pago.')}</p>
    <StorePresence key={selectedShop?.id} shop={selectedShop} />
    <div className="scanner__actions"><Button variant="secondary" icon="qr" onClick={start}>{active ? 'Cámara activa' : 'Activar cámara'}</Button><Button icon="arrowRight" onClick={() => navigate('payment')}>{t("Revisar compra")}</Button></div>
  </section>;
}
