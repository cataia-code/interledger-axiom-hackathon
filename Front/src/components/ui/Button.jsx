import { useTranslation } from '../../i18n/useTranslation';
import Icon from './Icon';

export function Button({ children, variant = 'primary', icon, className = '', ...props }) {
  const { t } = useTranslation();
  return <button className={`button button--${variant} ${className}`} {...props}>
    {typeof children === 'string' ? t(children) : children}{icon && <Icon name={icon} />}
  </button>;
}
export function IconButton({ icon, label, className = '', ...props }) {
  const { t } = useTranslation();
  return <button className={`icon-button ${className}`} aria-label={t(label)} {...props}><Icon name={icon} /></button>;
}
