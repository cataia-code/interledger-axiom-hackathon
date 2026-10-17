import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../ui/Icon';

export default function LogoutButton() {
  const { logout, navigate, notify } = useApp();
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  async function leave() {
    if (pending) return;
    setPending(true);
    try { await logout(); }
    catch (error) { notify(error.message); }
    finally { navigate('welcome'); setPending(false); }
  }
  return <button type="button" className="icon-button header-logout" aria-label={t('Cerrar sesión')} title={t('Cerrar sesión')} aria-busy={pending} disabled={pending} onClick={leave}><Icon name="logout" /><span>{t('Salir')}</span></button>;
}
