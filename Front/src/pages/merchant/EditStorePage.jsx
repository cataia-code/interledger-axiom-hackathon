import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { sellerService } from '../../services/seller/sellerService';
import { normalizeStore } from '../../services/marketplace/storeAdapter';
import { resolveImageURL } from '../../services/api/client';
import PageHeading from '../../components/ui/PageHeading';
import StoreImageEditor from '../../components/merchant/StoreImageEditor';
import { Button } from '../../components/ui/Button';
import StoreReceivingWallet from '../../components/payments/StoreReceivingWallet';
import { useStoreReceivingWallet } from '../../hooks/useStoreReceivingWallet';

const toForm = store => ({ name: store.name || '', description: store.description || '', address: store.address || '', city: store.city || '', phone: store.phone || '', latitude: store.latitude == null ? '' : String(store.latitude), longitude: store.longitude == null ? '' : String(store.longitude), status: store.status || 'active' });
export default function EditStorePage() {
  const { t } = useTranslation();
  const { user, navigate, cacheStore, ownedShop, notify } = useApp();
  const [state, setState] = useState({ loading: true, store: null, error: '' });
  const [form, setForm] = useState(null);
  const receiving = useStoreReceivingWallet(state.store?.id == null ? null : String(state.store.id));
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, store: null, error: '' }); setForm(null); setError(''); setSaved(false);
    sellerService.getStore({ signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      if (!result.store?.id) throw new Error('No pudimos cargar tu sucursal.');
      setState({ loading: false, store: result.store, error: '' }); setForm(toForm(result.store));
    }).catch(cause => { if (!controller.signal.aborted) setState({ loading: false, store: null, error: cause.message }); });
    return () => controller.abort();
  }, [user.id, revision]);
  async function updateImage(kind, file) {
    if (saving || mediaBusy) return false;
    setMediaBusy(true); setMediaError(''); let uploaded = false;
    try {
      await sellerService.uploadStoreImage(kind, file); uploaded = true;
      const result = await sellerService.getStore();
      const nextStore = result.store;
      setState(current => ({ ...current, store: nextStore }));
      cacheStore(normalizeStore({ ...ownedShop, ...nextStore, id: String(nextStore.id), ownerId: user.id, lat: Number(nextStore.latitude), lng: Number(nextStore.longitude), logo: resolveImageURL(nextStore.iconUrl) || '/assets/store-logo-fallback.svg', cover: resolveImageURL(nextStore.bannerUrl) || '/assets/store-cover-fallback.svg', area: [nextStore.address, nextStore.city].filter(Boolean).join(' · '), products: ownedShop?.products || [] }));
      notify(t('Imagen de tienda actualizada.')); return true;
    } catch (cause) { setMediaError(uploaded ? t('La imagen se guardó, pero no pudimos actualizar la vista. Vuelve a entrar para verla.') : cause.message); return uploaded; }
    finally { setMediaBusy(false); }
  }
  async function deleteImage(kind) {
    if (saving || mediaBusy) return;
    setMediaBusy(true); setMediaError(''); let removed = false;
    try {
      await sellerService.deleteStoreImage(kind); removed = true;
      const result = await sellerService.getStore(); const nextStore = result.store;
      setState(current => ({ ...current, store: nextStore }));
      cacheStore(normalizeStore({ ...ownedShop, ...nextStore, id: String(nextStore.id), ownerId: user.id, lat: Number(nextStore.latitude), lng: Number(nextStore.longitude), logo: resolveImageURL(nextStore.iconUrl) || '/assets/store-logo-fallback.svg', cover: resolveImageURL(nextStore.bannerUrl) || '/assets/store-cover-fallback.svg', area: [nextStore.address, nextStore.city].filter(Boolean).join(' · '), products: ownedShop?.products || [] }));
      notify(t('Imagen de tienda eliminada.'));
    } catch (cause) { setMediaError(removed ? t('La imagen se quitó, pero no pudimos actualizar la vista. Vuelve a entrar para verla.') : cause.message); }
    finally { setMediaBusy(false); }
  }
  function update(event) { setForm(current => ({ ...current, [event.target.name]: event.target.value })); setSaved(false); setError(''); }
  async function save(event) {
    event.preventDefault(); if (saving || mediaBusy || !form || !state.store) return;
    const latitude = Number(form.latitude), longitude = Number(form.longitude);
    if (!form.latitude.trim() || !form.longitude.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) { setError(t('Introduce coordenadas válidas para la tienda.')); return; }
    const values = { name: form.name.trim(), description: form.description.trim(), address: form.address.trim(), city: form.city.trim(), phone: form.phone.trim(), latitude, longitude, status: form.status };
    const initial = toForm(state.store);
    const body = Object.fromEntries(Object.entries(values).filter(([key, value]) => ['latitude', 'longitude'].includes(key) ? value !== Number(initial[key]) : value !== initial[key]));
    if (!Object.keys(body).length) { setSaved(true); return; }
    setSaving(true); setError(''); setSaved(false);
    try {
      const result = await sellerService.updateStore(body);
      const nextStore = { ...state.store, ...values, ...(result?.store || {}) };
      setState({ loading: false, store: nextStore, error: '' }); setForm(toForm(nextStore)); setSaved(true);
      // Keep the directory and merchant summary in sync without discarding cached products.
      cacheStore(normalizeStore({ ...ownedShop, ...nextStore, id: String(nextStore.id), ownerId: user.id,
        lat: nextStore.latitude == null ? null : Number(nextStore.latitude), lng: nextStore.longitude == null ? null : Number(nextStore.longitude),
        logo: resolveImageURL(nextStore.iconUrl) || ownedShop?.logo || '/assets/store-logo-fallback.svg',
        cover: resolveImageURL(nextStore.bannerUrl) || ownedShop?.cover || '/assets/store-cover-fallback.svg',
        area: [nextStore.address, nextStore.city].filter(Boolean).join(' · '), products: ownedShop?.products || [], rating: ownedShop?.rating || 0, reviews: ownedShop?.reviews || 0,
      }));
      notify(t('Tienda actualizada.'));
    } catch (cause) { setError(cause.message); }
    finally { setSaving(false); }
  }
  return <section className="create-store-page"><PageHeading eyebrow="TU NEGOCIO" title="Editar mi tienda" description="Revisa y actualiza los datos de tu sucursal." onBack={saving || mediaBusy ? undefined : () => navigate('seller')} />
    {state.loading ? <p role="status">{t('Cargando tu tienda…')}</p> : state.error ? <div role="alert"><p>{t(state.error)}</p><Button onClick={() => setRevision(value => value + 1)}>{t('Reintentar')}</Button></div> : form && <>
      <StoreReceivingWallet state={receiving} />
      <StoreImageEditor store={state.store} busy={saving || mediaBusy} onUpload={updateImage} onDelete={deleteImage} />{mediaError && <p className="field-error" role="alert">{mediaError}</p>}
      <form className="account-form seller-product-form" onSubmit={save}><fieldset disabled={saving || mediaBusy}>
        <label htmlFor="edit-store-name">{t('Nombre de tu tienda')}<input id="edit-store-name" name="name" value={form.name} onChange={update} minLength="2" maxLength="80" required /></label>
        <label htmlFor="edit-store-description">{t('Cuéntanos tu historia')}<textarea id="edit-store-description" name="description" value={form.description} onChange={update} rows="4" /></label>
        <label htmlFor="edit-store-address">{t('Dirección')}<input id="edit-store-address" name="address" value={form.address} onChange={update} minLength="5" maxLength="200" required /></label>
        <label htmlFor="edit-store-city">{t('Ciudad')}<input id="edit-store-city" name="city" value={form.city} onChange={update} minLength="2" maxLength="80" required /></label>
        <label htmlFor="edit-store-phone">{t('Teléfono')}<input id="edit-store-phone" type="tel" name="phone" value={form.phone} onChange={update} /></label>
        <div className="store-coordinate-fields"><label htmlFor="edit-store-latitude">{t('Latitud')}<input id="edit-store-latitude" type="number" step="any" min="-90" max="90" name="latitude" value={form.latitude} onChange={update} required /></label><label htmlFor="edit-store-longitude">{t('Longitud')}<input id="edit-store-longitude" type="number" step="any" min="-180" max="180" name="longitude" value={form.longitude} onChange={update} required /></label></div>
        <label htmlFor="edit-store-status">{t('Estado de la tienda')}<select id="edit-store-status" name="status" value={form.status} onChange={update}><option value="active">{t('Activa')}</option><option value="paused">{t('Pausada')}</option></select></label>
        <label htmlFor="edit-store-currency">{t('Moneda de la sucursal')}<input id="edit-store-currency" value={state.store.currency || ''} readOnly /></label><small>{t('La moneda de la sucursal no puede cambiarse.')}</small>
      </fieldset>{error && <p className="field-error" role="alert">{error}</p>}{saved && <p className="store-saved-status" role="status">{t('Cambios guardados.')}</p>}<Button className="wide" type="submit" disabled={saving || mediaBusy}>{t(saving ? 'Guardando…' : 'Guardar cambios')}</Button></form>
    </>}
  </section>;
}
