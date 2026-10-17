import { useTranslation } from '../../i18n/useTranslation';
import Icon from './Icon';
export default function MetricCard({ label, value, trend, icon }) {
  const { t } = useTranslation();
  return <article className="surface metric-card">{icon && <Icon name={icon} className="metric-card__icon" />}<small>{t(label)}</small><strong>{value}</strong>{trend && <span className="trend"><Icon name="growth" />{trend}</span>}</article>;
}
