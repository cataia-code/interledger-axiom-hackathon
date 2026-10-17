import { useTranslation } from '../../i18n/useTranslation';
import Icon from './Icon';
export default function RowLink({ icon, title, description, onClick }) {
  const { t } = useTranslation();
  return <button className="row-link surface" onClick={onClick}>{icon && <span className="row-link__icon"><Icon name={icon} /></span>}
    <span><b>{t(title)}</b>{description && <small>{t(description)}</small>}</span><Icon name="chevron" />
  </button>;
}
