import Icon from './Icon';
export default function MetricCard({ label, value, trend, icon }) {
  return <article className="surface metric-card">{icon && <Icon name={icon} className="metric-card__icon" />}<small>{label}</small><strong>{value}</strong>{trend && <span className="trend"><Icon name="growth" />{trend}</span>}</article>;
}
