import { useTranslation } from '../../i18n/useTranslation';
import { language } from '../../i18n/instance';
import MetricCard from '../ui/MetricCard';
import { SectionHeading } from '../ui/PageHeading';
import Icon from '../ui/Icon';
export function numberText(value, options = {}) {
  return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat(language(), options).format(value) : '—';
}
const levels = { gold: 'Oro', silver: 'Plata', bronze: 'Bronce', platinum: 'Platino' };
const confidenceLabels = { high: 'Alta', medium: 'Media', low: 'Baja' };
export function StoreScore({ stats }) {
  const { t } = useTranslation();
  const score = typeof stats?.score === 'number' && stats.score >= 0 && stats.score <= 100 ? stats.score : null;
  return <article className="surface store-score"><div><span className="eyebrow">{t('PUNTAJE DE LA TIENDA')}</span><strong>{numberText(score)}<small> / 100</small></strong><p>{t('Calculado a partir del catálogo, las ventas, la fiabilidad y la actividad.')}</p></div><div className="store-score__badges">{stats?.level && <span className="offer-pill"><Icon name="shield" />{t(levels[stats.level] || stats.level)}</span>}{stats?.stars != null && <span><Icon name="star" />{numberText(stats.stars, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 5</span>}</div><p className="caption">{t('Este puntaje refleja la actividad de la tienda; no es una valoración de reseñas.')}</p>{stats?.confidence && <small>{t('Confianza del cálculo')}: {t(confidenceLabels[stats.confidence] || stats.confidence)}</small>}</article>;
}
export default function StoreStatsPanel({ stats }) {
  const { t } = useTranslation();
  const metrics = stats?.metrics || {};
  return <><StoreScore stats={stats} /><SectionHeading title="Actividad del comercio" /><div className="metric-grid">{[['Productos activos', metrics.activeItems, 'bag'], ['Pedidos completados', metrics.ordersCompleted, 'check'], ['Tasa de finalización', metrics.completionRate == null ? null : metrics.completionRate * 100, 'growth'], ['Unidades vendidas', metrics.unitsSold, 'cart'], ['Compradores únicos', metrics.uniqueBuyers, 'people'], ['Pedidos en los últimos 30 días', metrics.ordersLast30d, 'shop']].map(([label, value, icon]) => <MetricCard key={label} label={label} icon={icon} value={label === 'Tasa de finalización' && typeof value === 'number' ? `${numberText(value, { maximumFractionDigits: 1 })}%` : numberText(value)} />)}</div><SectionHeading title="Cómo se compone el puntaje" /><div className="surface score-breakdown">{[['catalog', 'Catálogo'], ['sales', 'Ventas'], ['reliability', 'Fiabilidad'], ['activity', 'Actividad']].map(([key, label]) => { const value = stats?.breakdown?.[key]; return <div key={key}><span>{t(label)}</span><b>{numberText(value, { maximumFractionDigits: 1 })} {t('puntos')}</b>{typeof value === 'number' && Number.isFinite(value) && <meter min="0" max="100" value={Math.max(0, Math.min(100, value))} aria-label={t(label)} />}</div>; })}</div></>;
}
