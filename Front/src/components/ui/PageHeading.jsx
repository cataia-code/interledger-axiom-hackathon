import { IconButton } from './Button';
export default function PageHeading({ eyebrow, title, description, onBack }) {
  return <header className="page-heading">
    {onBack && <IconButton icon="arrowLeft" label="Volver" onClick={onBack} />}
    {eyebrow && <span className="eyebrow">{eyebrow}</span>}
    <h1>{title}</h1>{description && <p>{description}</p>}
  </header>;
}
export function SectionHeading({ title, children }) {
  return <div className="section-heading"><h2>{title}</h2>{children}</div>;
}
