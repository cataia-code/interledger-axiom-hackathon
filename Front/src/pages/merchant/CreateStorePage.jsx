import { useTranslation } from '../../i18n/useTranslation';
import { useEffect, useRef, useState } from 'react';
import { DATA_SOURCE } from '../../services/api/client';
import { marketplaceService } from '../../services/marketplace/marketplaceService';
import EditStorePage from './EditStorePage';
import { useApp } from '../../context/AppContext';
import { categories, neighborhoods } from '../../data/categories';
import PageHeading from '../../components/ui/PageHeading';
import StoreMediaField from '../../components/shops/StoreMediaField';
import { Button } from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';
export default function CreateStorePage() {
  return DATA_SOURCE === 'api' ? <EditStorePage /> : <MockStoreForm />;
}
function MockStoreForm() {
  const { t } = useTranslation();
  const { user, ownedShop, storesStatus, cacheStore, createStore, navigate, openAccount, notify, openShop } = useApp();
  const [form, setForm] = useState({ name: '', category: 'Artesanías', description: '', address: '', neighborhood: 'Laureles', logo: '', cover: '' });
  const [pending, setPending] = useState(false); const [error, setError] = useState('');
  const initializedStore = useRef(null);
  useEffect(() => {
    if (!ownedShop || initializedStore.current === ownedShop.id) return;
    initializedStore.current = ownedShop.id;
    setForm({ name: ownedShop.name || '', category: ownedShop.category || 'Artesanías', description: ownedShop.description || '', address: ownedShop.address || '', neighborhood: ownedShop.neighborhood || neighborhoods.find(area => ownedShop.area?.includes(area.name))?.name || 'Laureles', logo: ownedShop.logo || '', cover: ownedShop.cover || '' });
  }, [ownedShop]);
  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  async function submit(event) {
    event.preventDefault(); setPending(true); setError('');
    try { const store = ownedShop ? await marketplaceService.updateStore(ownedShop.id, form) : await createStore(form); cacheStore(store); notify(t(ownedShop ? 'Tienda actualizada.' : 'Tu tienda ya está creada. Puedes gestionarla desde tu cuenta de vendedor.')); openShop(store.id); }
    catch (cause) { setError(cause.message); } finally { setPending(false); }
  }
  if (!user) return <section className="create-store-intro"><Icon name="shop" /><h1>{t("Tu negocio tiene una historia.")}</h1><p>Crea tu cuenta para abrir una tienda. Usa una cuenta de vendedor para gestionar tu negocio.</p><Button className="wide" onClick={() => openAccount('sell', 'createStore', 'register')}>{t("Crear cuenta y abrir mi tienda")}</Button><Button variant="quiet" onClick={() => navigate('home/list')}>{t("Seguir explorando")}</Button></section>;
  if (storesStatus === 'loading' || (ownedShop && initializedStore.current !== ownedShop.id)) return <p role="status">{t('Cargando tu tienda…')}</p>;
  return <section className="create-store-page"><PageHeading eyebrow="COMPARTE LO QUE HACES" title={t(ownedShop ? 'Editar mi tienda' : 'Crea tu tienda')} description="Haz que más viajeros descubran tu negocio." onBack={() => navigate('profile')} />
    <form className="account-form" onSubmit={submit}><div className="store-media-fields"><StoreMediaField label="Logo de tu tienda" value={form.logo} onChange={logo => setForm(current => ({ ...current, logo }))} onError={setError} /><StoreMediaField label="Foto de portada" kind="cover" value={form.cover} onChange={cover => setForm(current => ({ ...current, cover }))} onError={setError} /></div>
      <label htmlFor="store-name">{t("Nombre de tu tienda")}<input id="store-name" name="name" value={form.name} onChange={update} placeholder="Ej. Taller de María" minLength={3} maxLength={60} required /></label>
      <label htmlFor="store-category">{t("Categoría")}<select id="store-category" name="category" value={form.category} onChange={update}>{categories.filter(value => value !== 'Todas').map(value => <option key={value}>{value}</option>)}</select></label>
      <label htmlFor="store-description">{t("Cuéntanos tu historia")}<textarea id="store-description" name="description" required minLength={15} maxLength={500} rows={3} value={form.description} onChange={update} placeholder="¿Qué hace especial a tu negocio?" /></label>
      <label htmlFor="store-neighborhood">{t("Barrio en Medellín")}<select id="store-neighborhood" name="neighborhood" value={form.neighborhood} onChange={update}>{neighborhoods.map(area => <option key={area.name}>{area.name}</option>)}</select></label>
      <p className="caption">{t("En esta demo, el pin se ubicará de forma aproximada en el barrio seleccionado.")}</p>
      <label htmlFor="store-address">{t("Dirección")}<input id="store-address" name="address" required value={form.address} onChange={update} maxLength={100} placeholder="Calle, carrera y número" /></label>
      {error && <p className="field-error" role="alert">{error}</p>}<Button className="wide" type="submit" disabled={pending} icon="shop">{t(pending ? 'Guardando…' : ownedShop ? 'Guardar cambios' : 'Crear mi tienda')}</Button>
    </form><p className="caption">{t("Las compras se realizan desde una cuenta de comprador.")}</p>
  </section>;
}
