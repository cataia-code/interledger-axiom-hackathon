import { useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import Icon from '../ui/Icon';
import MapShopSheet from './MapShopSheet';
import StoreMap from './StoreMap';
export default function HomeMap({ shops }) {
  const { selectedShopId, openShop } = useApp();
  const [selectedId, setSelectedId] = useState(selectedShopId);
  const mapRef = useRef(null);
  const visibleIds = useMemo(() => shops.map(shop => shop.id), [shops]);
  const selected = shops.find(shop => shop.id === selectedId) || shops[0];
  return <section className="home-map"><StoreMap ref={mapRef} shops={shops} visibleIds={visibleIds} selectedId={selected?.id} onSelect={setSelectedId} />
    <button className="home-map__locate" aria-label="Centrar mapa en Medellín" onClick={() => mapRef.current?.center()}><Icon name="locate" /></button><span className="home-map__count" role="status">{shops.length} {shops.length === 1 ? 'tienda' : 'tiendas'} · Medellín</span>
    {selected && <MapShopSheet shop={selected} onOpen={openShop} />}</section>;
}
