import { useTranslation } from '../../i18n/useTranslation';
import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { authService } from '../../services/auth/authService';
import { useOTPCooldown } from '../../hooks/useOTPCooldown';
import { Button } from '../ui/Button';
export default function OTPLoginForm({ email, onEmailChange, onAuthenticated, onPendingChange }) {
  const { t } = useTranslation();
  const { authenticateWithOTP } = useApp();
  const [otp, setOTP] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { onPendingChange?.(pending); return () => onPendingChange?.(false); }, [pending, onPendingChange]);
  const cooldown = useOTPCooldown();
  async function send(event) {
    event.preventDefault(); if (pending || cooldown.seconds) return;
    setError(''); setPending(true);
    try { await authService.sendVerificationOTP({ email, type: 'sign-in' }); setSentTo(email.trim()); setOTP(''); cooldown.start(); }
    catch (cause) { setError(cause.message); if (cause.status === 429) cooldown.start(cause.retryAfter || 60); }
    finally { setPending(false); }
  }
  async function login(event) {
    event.preventDefault(); setError(''); setPending(true);
    try { const account = await authenticateWithOTP({ email: sentTo, otp }); onAuthenticated(account); }
    catch (cause) { setError(cause.message); }
    finally { setPending(false); }
  }
  const codeStep = Boolean(sentTo) && sentTo === email.trim();
  return <><form className="account-form" onSubmit={codeStep ? login : send} aria-label={t("Iniciar sesión con código")}>
    <label htmlFor="otp-email">{t("Correo electrónico")}<input id="otp-email" type="email" autoComplete="email" required value={email} disabled={pending} onChange={event => onEmailChange(event.target.value)} placeholder={t("tu@correo.com")} /></label>
    {codeStep && <><p className="caption" role="status">{t('Si tienes una cuenta, recibirás un código en {{email}}. Vence en 10 minutos.', {email: sentTo})}</p><label htmlFor="login-otp">{t("Código de 6 dígitos")}<input id="login-otp" type="text" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="one-time-code" required value={otp} onChange={event => setOTP(event.target.value.replace(/\D/g, ''))} disabled={pending} placeholder={t("000000")} /></label></>}
    {error && <p className="field-error" role="alert">{error}</p>}
    <Button type="submit" className="wide" disabled={pending || (!codeStep && cooldown.seconds > 0)}>{pending ? 'Un momento…' : codeStep ? 'Iniciar sesión' : cooldown.seconds ? t('Espera {{count}} s', {count: cooldown.seconds}) : 'Enviar código'}</Button>
  </form>{codeStep && <Button className="wide" variant="quiet" disabled={pending || cooldown.seconds > 0} onClick={send}>{cooldown.seconds ? t('Reenviar en {{count}} s', {count: cooldown.seconds}) : 'Reenviar código'}</Button>}</>;
}
