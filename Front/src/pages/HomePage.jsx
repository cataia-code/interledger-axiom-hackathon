import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { categories } from '../data/categories';
import SearchField from '../components/ui/SearchField';
import FilterChips from '../components/ui/FilterChips';
import Icon from '../components/ui/Icon';
import HomeWalletCard from '../components/home/HomeWalletCard';
import StoreList from '../components/home/StoreList';
import HomeMap from '../components/map/HomeMap';
export default function HomePage() {
  const { shops, storesStatus, refreshStores, route, param, navigate } = useApp();
  const view = route === 'home' ? (param === 'list' ? 'list' : 'map') : route === 'map' ? 'map' : 'list';
  const [query, setQuery] = useState(''); const [category, setCategory] = useState('Todas');
  const filtered = useMemo(() => shops.filter(shop => (category === 'Todas' || shop.category === category) && `${shop.name} ${shop.category} ${shop.area} ${shop.products.map(product => product.name).join(' ')}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'))), [shops, query, category]);
  function resetFilters() { setQuery(''); setCategory('Todas'); }
  return <section className={`home-page home-page--${view}`}><div className="home-page__wallet"><HomeWalletCard /></div>
    <div className="home-page__search"><SearchField value={query} onChange={setQuery} label="Buscar tiendas" placeholder="Buscar tiendas, productos o categorías" /><FilterChips options={categories} value={category} onChange={setCategory} /></div>
    <div className="home-section-title"><h1>Tiendas cerca de ti</h1><span className="home-section-title__location"><Icon name="pin" />Medellín</span></div>
    <div className="home-view-switch" role="group" aria-label="Cómo explorar las tiendas"><button className={view === 'list' ? 'is-active' : ''} aria-pressed={view === 'list'} onClick={() => navigate('home/list')}><Icon name="list" />Lista</button><button className={view === 'map' ? 'is-active' : ''} aria-pressed={view === 'map'} onClick={() => navigate('home/map')}><Icon name="pin" />Mapa</button></div>
    <div className="home-results" key={view}>{storesStatus === 'loading' && <div className="home-loading" role="status">Buscando comercios cerca de ti…</div>}{storesStatus === 'error' && <div className="home-loading" role="alert"><span>No pudimos cargar las tiendas.</span><button onClick={refreshStores}>Reintentar</button></div>}
      {storesStatus === 'ready' && (view === 'map' ? <>{filtered.length ? <HomeMap shops={filtered} /> : <div className="map-empty">No hay tiendas con esos filtros.</div>}</> : <StoreList shops={filtered} onReset={resetFilters} />)}
    </div>
  </section>;
}
