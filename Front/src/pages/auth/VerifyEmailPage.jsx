import { useTranslation } from '../../i18n/useTranslation';
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { authService } from '../../services/auth/authService';
import { useOTPCooldown } from '../../hooks/useOTPCooldown';
import PageHeading from '../../components/ui/PageHeading';
import { Button } from '../../components/ui/Button';
export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const { user, refreshSession, navigate, notify } = useApp();
  const [otp, setOTP] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const cooldown = useOTPCooldown();
  const continueToApp = () => navigate(user.role === 'seller' ? 'seller' : 'home/list');
  async function send() {
    if (pending || cooldown.seconds) return;
    setPending(true); setError('');
    try { await authService.sendVerificationOTP({ email: user.email, type: 'email-verification' }); setSent(true); cooldown.start(); }
    catch (cause) { setError(cause.message); if (cause.status === 429) cooldown.start(cause.retryAfter || 60); }
    finally { setPending(false); }
  }
  async function verify(event) {
    event.preventDefault(); setPending(true); setError('');
    try { await authService.verifyEmail({ email: user.email, otp }); const account = await refreshSession(); if (!account) throw new Error('Tu sesión venció. Inicia sesión nuevamente.'); notify('Correo verificado.'); navigate(account.role === 'seller' ? 'seller' : 'home/list'); }
    catch (cause) { setError(cause.message); }
    finally { setPending(false); }
  }
  return <section className="account-page"><PageHeading eyebrow={t("TU CUENTA")} title={t("Verifica tu correo")} description={t('Puedes verificar {{email}} con un código enviado a ese correo. La verificación es opcional y puedes hacerla cuando quieras desde tu perfil.', {email:user.email})} />
    {user.emailVerified ? <><p role="status">{t("Tu correo ya está verificado.")}</p><Button className="wide" onClick={continueToApp}>{t("Continuar")}</Button></> : <><form onSubmit={verify} className="account-form"><label htmlFor="verify-otp">{t("Código de 6 dígitos")}<input id="verify-otp" type="text" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="one-time-code" required value={otp} onChange={event => setOTP(event.target.value.replace(/\D/g, ''))} disabled={pending} placeholder={t("000000")} /></label>{error && <p className="field-error" role="alert">{error}</p>}<Button className="wide" type="submit" disabled={pending}>{pending ? 'Un momento…' : 'Verificar correo'}</Button></form><Button className="wide" variant="secondary" disabled={pending || cooldown.seconds > 0} onClick={send}>{cooldown.seconds ? t('Reenviar en {{count}} s', {count: cooldown.seconds}) : 'Solicitar nuevo código'}</Button>{sent && <p className="caption" role="status">{t("Código enviado. Revisa tu correo; vence en 10 minutos.")}</p>}<Button className="wide" variant="quiet" disabled={pending} onClick={continueToApp}>{t("Continuar sin verificar")}</Button></>}
  </section>;
}
