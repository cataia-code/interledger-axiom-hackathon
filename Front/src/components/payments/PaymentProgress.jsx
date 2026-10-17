import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../ui/Icon';

export default function PaymentProgress({ message }) {
  const { t } = useTranslation();
  return <div className="payment-progress" role="status" aria-live="polite"><span className="payment-progress__spinner" aria-hidden="true"><Icon name="wallet" /></span><div><b>{t(message)}</b><small>{t('Espera un momento. Evita iniciar otro pago mientras comprobamos este.')}</small></div></div>;
}
