import { useTranslation } from '../i18n/useTranslation';
import { DATA_SOURCE } from '../services/api/client';
import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { categories } from '../data/categories';
import SearchField from '../components/ui/SearchField';
import FilterChips from '../components/ui/FilterChips';
import Icon from '../components/ui/Icon';
import HomeWalletCard from '../components/home/HomeWalletCard';
import StoreList from '../components/home/StoreList';
import HomeMap from '../components/map/HomeMap';
export default function HomePage() {
  const { t } = useTranslation();
  const { shops, storesStatus, refreshStores, route, param, navigate, homeFilters, setHomeFilters } = useApp();
  const view = route === 'home' ? (param === 'list' ? 'list' : 'map') : route === 'map' ? 'map' : 'list';
  const { query, category } = homeFilters;
  const setQuery = query => setHomeFilters(current => ({ ...current, query }));
  const setCategory = category => setHomeFilters(current => ({ ...current, category }));
  const filtered = useMemo(() => shops.filter(shop => (category === 'Todas' || shop.category === category) && `${shop.name} ${shop.category} ${shop.area} ${shop.products.map(product => product.name).join(' ')}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'))), [shops, query, category]);
  function resetFilters() { setQuery(''); setCategory('Todas'); }
  return <section className={`home-page home-page--${view}`}><div className="home-page__wallet"><HomeWalletCard /></div>
    <div className="home-page__search"><SearchField value={query} onChange={setQuery} label={t("Buscar tiendas")} placeholder={t("Buscar tiendas, productos o categorías")} /><FilterChips options={DATA_SOURCE === 'api' ? ['Todas'] : categories} value={category} onChange={setCategory} /></div>
    <div className="home-section-bar"><h1>{t(DATA_SOURCE === 'api' ? 'Tiendas para descubrir' : 'Tiendas cerca de ti')}</h1><div className="home-view-switch" role="group" aria-label={t("Cómo explorar las tiendas")}><button className={view === 'list' ? 'is-active' : ''} aria-pressed={view === 'list'} onClick={() => navigate('home/list')}><Icon name="list" />{t("Lista")}</button><button className={view === 'map' ? 'is-active' : ''} aria-pressed={view === 'map'} onClick={() => navigate('home/map')}><Icon name="pin" />{t("Mapa")}</button></div></div>
    <div className="home-results" key={view}>{storesStatus === 'loading' && <div className="home-loading" role="status">{t("Buscando comercios cerca de ti…")}</div>}{storesStatus === 'error' && <div className="home-loading" role="alert"><span>{t("No pudimos cargar las tiendas.")}</span><button onClick={refreshStores}>{t("Reintentar")}</button></div>}
      {storesStatus === 'ready' && (view === 'map' ? <HomeMap shops={filtered} /> : <StoreList shops={filtered} onReset={resetFilters} />)}
    </div>
  </section>;
}
