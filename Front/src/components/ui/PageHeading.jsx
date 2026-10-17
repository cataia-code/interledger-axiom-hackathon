import { useTranslation } from '../../i18n/useTranslation';
import { IconButton } from './Button';
export default function PageHeading({ eyebrow, title, description, onBack }) {
  const { t } = useTranslation();
  return <header className="page-heading">
    {onBack && <IconButton icon="arrowLeft" label={t("Volver")} onClick={onBack} />}
    {eyebrow && <span className="eyebrow">{t(eyebrow)}</span>}
    <h1>{t(title)}</h1>{description && <p>{t(description)}</p>}
  </header>;
}
export function SectionHeading({ title, children }) {
  const { t } = useTranslation();
  return <div className="section-heading"><h2>{t(title)}</h2>{children}</div>;
}
