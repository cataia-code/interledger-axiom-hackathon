import Icon from '../ui/Icon';
import { useTranslation } from '../../i18n/useTranslation';

export default function PaymentReturnCountdown({ remainingMs, totalMs, fallback }) {
  const { t } = useTranslation();
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const circumference = 2 * Math.PI * 52;
  const ratio = Math.max(0, Math.min(1, remainingMs / totalMs));
  return <section className="return-countdown surface">
    <span className="return-countdown__eyebrow">{t('REGRESO A TU COMPRA')}</span>
    <div className={`return-countdown__dial ${fallback ? 'return-countdown__dial--done' : ''}`} role="timer" aria-label={t('Tiempo para volver: {{seconds}} segundos', { seconds })}>
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle className="return-countdown__track" cx="60" cy="60" r="52" /><circle className="return-countdown__arc" cx="60" cy="60" r="52" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - ratio)} /></svg>
      {fallback ? <Icon name="arrowLeft" /> : <span><b>{seconds}</b><small>{t(seconds === 1 ? 'segundo' : 'segundos')}</small></span>}
    </div>
    <h1>{t(fallback ? 'Vuelve a tu app' : 'Volviendo a Lokora')}</h1>
    <p>{t(fallback ? 'El navegador mantiene esta ventana abierta. Puedes cerrarla para continuar en Lokora.' : 'Estamos avisando a tu app para que compruebe el resultado del pago.')}</p>
    {!fallback && <div className="return-countdown__connection" role="status"><span aria-hidden="true" />{t('Conectando con tu compra…')}</div>}
    <small className="return-countdown__reference">{t('El estado del pago se confirma con el servidor.')}</small>
  </section>;
}
