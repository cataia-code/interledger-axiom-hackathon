import LanguageSelector from '../components/language/LanguageSelector';
import { useTranslation } from '../i18n/useTranslation';
import { Button } from '../components/ui/Button';
import { useApp } from '../context/AppContext';
export default function WelcomePage() {
  const { t } = useTranslation();
  const { openAccount } = useApp();
  return <section className="welcome welcome--reference"><LanguageSelector compact /><div className="welcome__brand"><img className="brand-logo brand-logo--full" src="/assets/lokora-brand.png" alt="Lokora · go global, grow local" width={270} height={257} /></div>
    <div className="welcome__waves" aria-hidden="true"><svg viewBox="0 0 500 230" preserveAspectRatio="none"><path fill="#e4be87" d="M0 80C90 10 150 10 230 100S390 210 500 130V230H0z"/><path fill="#2e7d73" fillOpacity=".8" d="M0 130C100 90 170 220 280 150S420 130 500 190V230H0z"/><path fill="#a12d4a" fillOpacity=".86" d="M220 175C310 55 400 40 500 130V230H220z"/><path fill="#f8f4e7" d="M0 204C120 150 180 192 260 195S410 170 500 225V230H0z"/></svg></div>
    <div className="welcome__actions"><Button className="wide" onClick={() => openAccount('buy', 'home', 'register')}>{t("Crear cuenta")}</Button><Button variant="secondary" className="wide" onClick={() => openAccount('buy', 'home', 'login')}>{t("Iniciar sesión")}</Button><p className="caption">{t("Inicia sesión para explorar tiendas, productos y beneficios.")}</p></div>
  </section>;
}
