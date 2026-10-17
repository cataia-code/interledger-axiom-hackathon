import Icon from './Icon';

export function Button({ children, variant = 'primary', icon, className = '', ...props }) {
  return <button className={`button button--${variant} ${className}`} {...props}>
    {children}{icon && <Icon name={icon} />}
  </button>;
}
export function IconButton({ icon, label, className = '', ...props }) {
  return <button className={`icon-button ${className}`} aria-label={label} {...props}><Icon name={icon} /></button>;
}
