import { useTranslation } from '../../i18n/useTranslation';
import { useDeviceLocation } from '../../hooks/useDeviceLocation';
import { distanceMeters } from '../../lib/geo';
import { Button } from '../ui/Button';
export default function StorePresence({ shop }) {
  const { t } = useTranslation();
  const { location, status, error, requestLocation } = useDeviceLocation();
  const distance = distanceMeters(location, shop);
  return <section className="store-presence" aria-label={t("Cercanía a la tienda")}><h2>{t("¿Ya estás en la tienda?")}</h2><p>{t("Consulta tu distancia antes de comprar. Solo pediremos tu ubicación cuando pulses el botón.")}</p>
    <Button variant="secondary" icon="pin" disabled={status === 'loading'} onClick={requestLocation}>{status === 'loading' ? 'Consultando ubicación…' : location ? 'Actualizar ubicación' : 'Consultar mi cercanía'}</Button>
    <div role="status">{error && <p>{error}</p>}{location && <p>{distance === null ? 'Esta tienda aún no tiene coordenadas válidas.' : `Distancia estimada: ${distance < 1000 ? `${Math.round(distance)} m` : `${(distance / 1000).toFixed(1)} km`}.`} Precisión del dispositivo: ±{Math.round(location.accuracy)} m.</p>}</div>
    <small>{t("Los puntos de esta demo son aproximados. El GPS no confirma tu presencia. Tu ubicación se usa en esta pantalla y no se envía ni se guarda.")}</small>
  </section>;
}
