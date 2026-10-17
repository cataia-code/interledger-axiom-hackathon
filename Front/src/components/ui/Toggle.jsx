import { useTranslation } from '../../i18n/useTranslation';
export default function Toggle({ label, checked, onChange }) {
  const { t } = useTranslation();
  return <button className="toggle" role="switch" aria-checked={checked} aria-label={t(label)} onClick={() => onChange(!checked)}><span /></button>;
}
