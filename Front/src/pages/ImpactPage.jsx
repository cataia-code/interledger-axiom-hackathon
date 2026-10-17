import { useTranslation } from '../i18n/useTranslation';
import { useApp } from '../context/AppContext';
import { DATA_SOURCE } from '../services/api/client';
import { useImpactStats } from '../hooks/useImpactStats';
import { storeStatsPreviewStore } from '../data/stats';
import StoreLogo from '../components/shops/StoreLogo';
import { numberText } from '../components/impact/StoreStatsPanel';
import { SectionHeading } from '../components/ui/PageHeading';
import MetricCard from '../components/ui/MetricCard';
import Icon from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
export default function ImpactPage() {
  const { t } = useTranslation();
  const { navigate, shops, user, param } = useApp();
  const showExample = param === 'demo';
  const displayShops = !shops.length && (showExample || DATA_SOURCE === 'mock') ? [storeStatsPreviewStore] : shops;
  const stats = useImpactStats(user?.id, displayShops, { demo: showExample });
  const overview = stats.marketplace;
  const rankedStores = displayShops.map(shop => ({ shop, stats: stats.storeStats[String(shop.id)] }))
    .filter(row => row.stats && typeof row.stats.score === 'number')
    .sort((a, b) => b.stats.score - a.stats.score);
  return <><header className="page-heading"><span className="eyebrow">{t('DATOS DEL MARKETPLACE')}</span><h1>{t('Estadísticas y puntaje de tiendas')}</h1><p>{t('Actividad del marketplace y un puntaje de 0 a 100 por tienda.')}</p></header>
    {stats.demo && <p className="impact-notice">{t('Vista de demostración: las cifras son ejemplos y no corresponden a datos reales.')}</p>}
    <SectionHeading title="Panorama del marketplace" />
    {stats.pending ? <div className="surface impact-status" role="status">{t('Cargando estadísticas…')}</div> : overview ? <div className="metric-grid">{[['Tiendas', overview.stores, 'shop'], ['Productos', overview.items, 'bag'], ['Pedidos', overview.orders, 'cart'], ['Usuarios', overview.users, 'people']].map(([label, value, icon]) => <MetricCard key={label} label={label} value={numberText(value)} icon={icon} />)}</div> : <div className="surface impact-status" role="status"><p>{t('El resumen del marketplace no está disponible todavía.')}</p><Button variant="secondary" onClick={stats.refresh}>{t('Reintentar')}</Button></div>}
    {stats.marketplaceError && !stats.demo && <p className="caption" role="status">{t('La API todavía no entrega el panorama del marketplace. El puntaje público por tienda se consulta por separado.')}</p>}
    <SectionHeading title="Puntaje público de tiendas" />
    {stats.pending ? <div className="surface impact-status" role="status">{t('Cargando puntajes…')}</div> : rankedStores.length ? <div className="impact-stores">{rankedStores.map(({ shop, stats: storeStats }, index) => <button className="surface impact-store" key={shop.id} onClick={() => navigate(`impactDetail/${shop.id}${stats.demo ? '/demo' : ''}`)}><strong className="impact-store__rank">{index + 1}</strong><StoreLogo shop={shop} /><span className="impact-store__name"><b>{shop.name}</b><small>{t('Nivel')} · {t(({ gold: 'Oro', silver: 'Plata', bronze: 'Bronce' })[storeStats.level] || storeStats.level || 'Sin nivel')}</small></span><strong className="impact-store__score">{numberText(storeStats.score)}<small> / 100</small></strong><Icon name="chevron" /></button>)}</div> : <div className="surface impact-status"><p>{stats.demo ? t('No hay tiendas de ejemplo para puntuar.') : t('Todavía no hay puntajes disponibles para las tiendas cargadas.')}</p>{!stats.demo && <Button variant="secondary" onClick={stats.refresh}>{t('Reintentar')}</Button>}</div>}
    {!stats.demo && DATA_SOURCE === 'api' && <Button className="wide space-top" variant="quiet" onClick={() => navigate('impact/demo')}>{t('Ver ejemplo de puntaje')}</Button>}
    {showExample && DATA_SOURCE === 'api' && <Button className="wide space-top" variant="secondary" onClick={() => navigate('impact')}>{t('Volver a datos reales')}</Button>}
    <SectionHeading title="Qué mide el puntaje" /><p className="caption">{t('Catálogo, ventas, fiabilidad y actividad. El puntaje no equivale a reseñas ni a una calificación de clientes.')}</p>
    {rankedStores.length > 0 && <p className="caption">{t('Los puntajes se ordenan entre las tiendas cargadas con datos disponibles.')}</p>}
    {Object.keys(stats.storeErrors).length > 0 && rankedStores.length > 0 && <p className="caption" role="status">{t('Algunas tiendas no tienen estadísticas disponibles.')}</p>}
  </>;
}
