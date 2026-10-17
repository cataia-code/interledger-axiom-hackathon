import { useTranslation } from '../../i18n/useTranslation';
import { useMemo, useRef, useState } from 'react';
import { distanceMeters, validCoordinates } from '../../lib/geo';
import { useDeviceLocation } from '../../hooks/useDeviceLocation';
import { useApp } from '../../context/AppContext';
import Icon from '../ui/Icon';
import MapShopSheet from './MapShopSheet';
import StoreMap from './StoreMap';
export default function HomeMap({ shops }) {
  const { t } = useTranslation();
  const { selectedShopId, setSelectedShopId, openShop, shops: allShops } = useApp();
  const mapRef = useRef(null);
  const { location, status: locationStatus, error: locationError, requestLocation } = useDeviceLocation();
  const [nearby, setNearby] = useState(false);
  const mapShops = useMemo(() => allShops.filter(validCoordinates), [allShops]);
  const nearbyShops = useMemo(() => {
    if (!nearby || !location) return shops.filter(validCoordinates).map(shop => ({ shop, distance: null }));
    const ordered = shops.filter(validCoordinates).map(shop => ({ shop, distance: distanceMeters(location, shop) })).sort((a, b) => a.distance - b.distance);
    const within = ordered.filter(entry => entry.distance <= 8000);
    return within;
  }, [shops, location, nearby]);
  const visibleShops = useMemo(() => nearbyShops.map(entry => entry.shop), [nearbyShops]);
  const visibleIds = useMemo(() => visibleShops.map(shop => shop.id), [visibleShops]);
  const selected = visibleShops.find(shop => shop.id === selectedShopId) || visibleShops[0];
  function locate() {
    setNearby(true);
    if (locationStatus === 'ready') mapRef.current?.centerOn(location);
    else requestLocation();
  }
  return <section className="home-map"><StoreMap ref={mapRef} shops={mapShops} visibleIds={visibleIds} selectedId={selected?.id} onSelect={setSelectedShopId} location={nearby ? location : null} />
    <button className={`home-map__locate ${nearby && locationStatus === 'ready' ? 'is-active' : ''}`} disabled={locationStatus === 'loading'} aria-label={t('Buscar tiendas cerca de mí')} onClick={locate}><Icon name="locate" /><span>{t(locationStatus === 'loading' ? 'Buscando ubicación…' : 'Cerca de mí')}</span></button>
    <span className="home-map__count" role="status">{visibleShops.length} {visibleShops.length === 1 ? t('tienda') : t('tiendas')} · {nearby && locationStatus === 'ready' ? t('A menos de 8 km') : selected?.city || t('Mapa')}</span>
    {nearby && locationStatus === 'ready' && <button className="home-map__show-all" onClick={() => { setNearby(false); mapRef.current?.center(); }}>{t('Ver toda la ciudad')}</button>}
    {nearby && locationError && <p className="home-map__location-error" role="status">{t(locationError)} {t('Seguimos mostrando todas las tiendas.')}</p>}
    {nearby && locationStatus === 'ready' && !visibleShops.length && <p className="home-map__location-error" role="status">{t('No encontramos tiendas a menos de 8 km con estos filtros. Puedes ver toda la ciudad.')}</p>}
    {selected && <MapShopSheet shop={selected} distance={nearbyShops.find(entry => entry.shop.id === selected.id)?.distance} onOpen={openShop} />}</section>;
}
