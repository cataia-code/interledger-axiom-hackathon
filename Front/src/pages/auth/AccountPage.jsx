import LanguageSelector from '../../components/language/LanguageSelector';
import { useTranslation } from '../../i18n/useTranslation';
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import BrandLogo from '../../components/layout/BrandLogo';
import { Button, IconButton } from '../../components/ui/Button';
import { isMerchantRoute } from '../../app/access';
import SellerRegistrationFields from '../../components/auth/SellerRegistrationFields';
import OTPLoginForm from '../../components/auth/OTPLoginForm';
import AccountIntent from '../../components/auth/AccountIntent';
import { DATA_SOURCE } from '../../services/api/client';
import { normalizeWalletAddress } from '../../lib/paymentWallet';
import { savedWalletService } from '../../services/payments/savedWalletService';

export default function AccountPage({ register = false }) {
  const { t } = useTranslation();
  const { navigate, authenticate, authIntent, setAuthIntent, authReturnTo, notify } = useApp();
  const [form, setForm] = useState({ name: '', email: '', password: '', walletAddress: '', storeWalletAddress: '', legalName: '', tradeName: '', taxId: '', organizationLegalId: '', country: 'CO', legalAddress: '', storeName: '', storeLegalId: '', storeAddress: '', storeCity: 'Medellín', storeCurrency: 'COP', latitude: '', longitude: '' });
  const [loginMode, setLoginMode] = useState('password');
  const [otpPending, setOTPPending] = useState(false);
  const [pending, setPending] = useState(false); const [error, setError] = useState('');
  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  function finishAuthentication(account) {
    setForm(current => ({ ...current, password: '' }));
    const destination = authReturnTo === 'home' || isMerchantRoute(authReturnTo.split('/')[0]) ? 'home/list' : authReturnTo;
    navigate(account.role === 'seller' ? 'seller' : destination);
  }
  async function submit(event) {
    event.preventDefault(); setError(''); setPending(true);
    try {
      const registeringSeller = DATA_SOURCE === 'api' && register && authIntent === 'sell';
      // Validate before creating the account. Wallet association is a separate
      // authenticated request, never an undocumented sign-up field.
      const receivingAddress = registeringSeller ? normalizeWalletAddress(form.storeWalletAddress) : null;
      const seller = DATA_SOURCE === 'api' && register && authIntent === 'sell' ? {
        organization: { legalName: form.legalName, tradeName: form.tradeName || undefined, taxId: form.taxId, legalId: form.organizationLegalId, country: form.country.toUpperCase(), legalAddress: form.legalAddress },
        store: { name: form.storeName, legalId: form.storeLegalId, address: form.storeAddress, city: form.storeCity, currency: form.storeCurrency, latitude: Number(form.latitude), longitude: Number(form.longitude) },
      } : {};
      const credentials = register ? { ...form, ...seller, initialIntent: authIntent } : { email: form.email, password: form.password };
      const account = await authenticate(credentials, register);
      if (registeringSeller) {
        setForm(current => ({ ...current, password: '' }));
        try {
          await savedWalletService.add(account.id, { name: form.storeName.trim().slice(0, 60), address: receivingAddress });
        } catch (cause) {
          // The account/store already exist: recover in wallet management
          // rather than asking the user to submit sign-up a second time.
          notify(t('Tu cuenta y tienda se crearon. No pudimos asociar la wallet; complétala en Mis wallets.'));
          navigate('wallets/setup'); return;
        }
        notify(t('Tu tienda se creó. Revisa su wallet y moneda antes de recibir pagos.'));
        navigate('wallets/setup'); return;
      }
      finishAuthentication(account);
    } catch (cause) { setError(cause.message); } finally { setPending(false); }
  }
  return <section className="account-page"><div className="account-page__top"><IconButton icon="arrowLeft" label={t("Volver a la bienvenida")} onClick={() => navigate('welcome')} /><BrandLogo /><LanguageSelector /></div>
    <header><span className="eyebrow">{t("GO GLOBAL, GROW LOCAL")}</span><h1>{t(register ? 'Tu viaje empieza aquí.' : 'Qué bueno verte de nuevo.')}</h1><p>{t(register ? 'Elige una cuenta de comprador o de vendedor.' : 'Ingresa con tu correo y contraseña.')}</p></header>
    {register && <AccountIntent value={authIntent} onChange={setAuthIntent} />}
    {!register && DATA_SOURCE === 'api' && <div className="auth-methods" role="group" aria-label={t("Método de acceso")}><button type="button" disabled={pending || otpPending} aria-pressed={loginMode === 'password'} onClick={() => { setLoginMode('password'); setError(''); }}>{t("Con contraseña")}</button><button type="button" disabled={pending || otpPending} aria-pressed={loginMode === 'otp'} onClick={() => { setLoginMode('otp'); setError(''); }}>{t("Con código por correo")}</button></div>}
    {!register && loginMode === 'otp' ? <OTPLoginForm email={form.email} onEmailChange={email => setForm(current => ({ ...current, email }))} onAuthenticated={finishAuthentication} onPendingChange={setOTPPending} /> : <form onSubmit={submit} className="account-form" aria-label={register ? 'Crear cuenta Lokora' : 'Iniciar sesión en Lokora'}>
      {register && <label htmlFor="account-name">{t("Tu nombre")}<input id="account-name" name="name" autoComplete="name" required minLength={2} maxLength={70} value={form.name} onChange={update} placeholder={t("¿Cómo te llamas?")} /></label>}
      <label htmlFor="account-email">{t("Correo electrónico")}<input id="account-email" name="email" type="email" required autoComplete="email" value={form.email} onChange={update} placeholder={t("tu@correo.com")} /></label>
      <label htmlFor="account-password">{t("Contraseña")}<input id="account-password" name="password" type="password" required minLength={8} autoComplete={register ? 'new-password' : 'current-password'} value={form.password} onChange={update} placeholder={t("Al menos 8 caracteres")} /></label>
      {register && DATA_SOURCE === 'mock' && authIntent === 'buy' && <label htmlFor="account-wallet">{t("Dirección de tu wallet compatible con Open Payments · opcional")}<input id="account-wallet" name="walletAddress" type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={form.walletAddress} onChange={update} placeholder="$ilp.interledger-test.dev/tu-wallet" aria-describedby="account-wallet-help" /><small id="account-wallet-help">{t("Ingresa el Payment Pointer de tu wallet compatible con Open Payments, que empieza por $. También aceptamos su dirección HTTPS. También puedes conectarla al comprar. Lokora no consulta ni guarda tu saldo.")}</small></label>}
      {register && DATA_SOURCE === 'api' && authIntent === 'sell' && <SellerRegistrationFields values={form} onChange={update} />}
      {error && <p className="field-error" role="alert">{error}</p>}
      <Button type="submit" className="wide" disabled={pending} icon="arrowRight">{pending ? 'Un momento…' : register ? 'Crear mi cuenta' : 'Iniciar sesión'}</Button>
    </form>}
    <p className="account-page__switch">{t(register ? '¿Ya tienes cuenta?' : '¿Todavía no tienes cuenta?')} <button disabled={pending || otpPending} onClick={() => navigate(register ? 'login' : 'register')}>{t(register ? 'Inicia sesión' : 'Crea tu cuenta')}</button></p>
    {DATA_SOURCE === 'mock' && <small className="account-page__demo">{t("Acceso de demostración: puedes probar con cualquier correo válido y una contraseña de 8 caracteres. No uses una contraseña real.")}</small>}
  </section>;
}
