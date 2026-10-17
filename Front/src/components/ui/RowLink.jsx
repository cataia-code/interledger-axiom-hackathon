import Icon from './Icon';
export default function RowLink({ icon, title, description, onClick }) {
  return <button className="row-link surface" onClick={onClick}>{icon && <span className="row-link__icon"><Icon name={icon} /></span>}
    <span><b>{title}</b>{description && <small>{description}</small>}</span><Icon name="chevron" />
  </button>;
}
