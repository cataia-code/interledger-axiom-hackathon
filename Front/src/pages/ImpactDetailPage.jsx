import { useTranslation } from '../i18n/useTranslation';
import { useApp } from '../context/AppContext';
import { DATA_SOURCE } from '../services/api/client';
import { useImpactStats } from '../hooks/useImpactStats';
import { storeStatsPreviewStore } from '../data/stats';
import PageHeading from '../components/ui/PageHeading';
import StoreLogo from '../components/shops/StoreLogo';
import StoreStatsPanel from '../components/impact/StoreStatsPanel';
import { Button } from '../components/ui/Button';

export default function ImpactDetailPage() {
  const { t } = useTranslation();
  const { navigate, shops, param, user, path } = useApp();
  const showExample = path.split('/')[2] === 'demo';
  const shop = shops.find(item => String(item.id) === String(param)) || ((showExample || DATA_SOURCE === 'mock') && param === storeStatsPreviewStore.id ? storeStatsPreviewStore : null);
  const stats = useImpactStats(user?.id, shop ? [shop] : [], { demo: showExample });
  const storeStats = stats.storeStats[String(param)];
  if (!shop) return <><PageHeading title="Tienda no disponible" onBack={() => navigate(showExample ? 'impact/demo' : 'impact')} /><Button onClick={() => navigate(showExample ? 'impact/demo' : 'impact')}>{t('Volver al impacto')}</Button></>;
  return <><PageHeading eyebrow={t('PUNTAJE PÚBLICO')} title={shop.name} description={shop.description} onBack={() => navigate(showExample ? 'impact/demo' : 'impact')} />
    {stats.demo && <p className="impact-notice">{t('Vista de demostración: las cifras son ejemplos y no corresponden a datos reales.')}</p>}
    <div className="surface impact-store-detail"><StoreLogo shop={shop} /><span>{shop.city} · {shop.currency}</span></div>
    {stats.pending ? <div className="surface impact-status" role="status">{t('Cargando puntaje…')}</div> : storeStats ? <StoreStatsPanel stats={storeStats} /> : <div className="surface impact-status"><p>{t('El puntaje de esta tienda no está disponible todavía.')}</p><Button variant="secondary" onClick={stats.refresh}>{t('Reintentar')}</Button></div>}
    {!stats.demo && DATA_SOURCE === 'api' && <Button className="wide space-top" variant="quiet" onClick={() => navigate(`impactDetail/${param}/demo`)}>{t('Ver ejemplo de puntaje')}</Button>}
  </>;
}
