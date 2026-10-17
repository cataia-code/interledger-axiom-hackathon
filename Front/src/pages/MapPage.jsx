import { useMemo, useRef, useState } from 'react';
import { shops, categories } from '../data/shops';
import { useApp } from '../context/AppContext';
import PageHeading from '../components/ui/PageHeading';
import SearchField from '../components/ui/SearchField';
import FilterChips from '../components/ui/FilterChips';
import { IconButton } from '../components/ui/Button';
import StoreMap from '../components/map/StoreMap';
import MapShopSheet from '../components/map/MapShopSheet';
export default function MapPage() {
  const { openShop, selectedShopId } = useApp();
  const [selectedId, setSelectedId] = useState(selectedShopId);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const mapRef = useRef(null);
  const filtered = useMemo(() => shops.filter(shop => (category === 'Todas' || shop.category === category) &&
    `${shop.name} ${shop.category} ${shop.area} ${shop.products.map(product => product.name).join(' ')}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'))), [category, query]);
  const visibleIds = useMemo(() => filtered.map(shop => shop.id), [filtered]);
  const selected = filtered.find(shop => shop.id === selectedId) || filtered[0];
  return <><PageHeading eyebrow="MEDELLÍN, COLOMBIA" title="Tiendas en el mapa" description="Tu próxima historia está cerca." />
    <section className="map-wrap"><StoreMap ref={mapRef} shops={shops} visibleIds={visibleIds} selectedId={selected?.id} onSelect={setSelectedId} />
      <div className="map-search"><SearchField value={query} onChange={setQuery} placeholder="Buscar tiendas o barrios" label="Buscar tiendas en el mapa" /><IconButton icon="locate" label="Centrar mapa en Medellín" onClick={() => mapRef.current?.center()} /></div>
      <div className="map-filters"><FilterChips options={categories} value={category} onChange={setCategory} /></div>
      <span className="map-count" role="status">{filtered.length ? `${filtered.length} tiendas de ejemplo en esta zona` : 'No encontramos tiendas con esos filtros'}</span>
      {selected && <MapShopSheet shop={selected} onOpen={openShop} />}
    </section>
  </>;
}
