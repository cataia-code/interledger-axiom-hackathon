import { useMemo, useState } from 'react';
import PageHeading, { SectionHeading } from '../components/ui/PageHeading';
import SearchField from '../components/ui/SearchField';
import FilterChips from '../components/ui/FilterChips';
import ShopCard from '../components/shops/ShopCard';
import { Button } from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { shops, categories } from '../data/shops';
import { useApp } from '../context/AppContext';
export default function ExplorePage() {
  const { openShop, favorites, toggleFavorite, navigate } = useApp();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const filtered = useMemo(() => shops.filter(shop => (category === 'Todas' || shop.category === category) &&
    `${shop.name} ${shop.category} ${shop.area} ${shop.products.map(product => product.name).join(' ')}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'))), [query, category]);
  return <><PageHeading eyebrow="MEDELLÍN, COLOMBIA" title="Descubre tiendas" description="Apoya el talento local en cada parada." />
    <SearchField value={query} onChange={setQuery} /><FilterChips options={categories} value={category} onChange={setCategory} />
    <SectionHeading title="Tiendas cerca de ti"><Button variant="quiet" icon="pin" onClick={() => navigate('map')}>Ver mapa</Button></SectionHeading>
    <div className="shop-list">{filtered.map(shop => <ShopCard key={shop.id} shop={shop} onOpen={openShop} isFavorite={favorites.includes(shop.id)} onFavorite={toggleFavorite} />)}</div>
    {!filtered.length && <div className="empty-state"><Icon name="search" /><p>No encontramos tiendas con esa búsqueda.</p><Button variant="secondary" onClick={() => { setQuery(''); setCategory('Todas'); }}>Ver todas las tiendas</Button></div>}
  </>;
}
