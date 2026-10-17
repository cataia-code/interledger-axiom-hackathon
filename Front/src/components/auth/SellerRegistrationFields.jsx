import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { sellerCountries } from '../../data/sellerLocations';
import { geocodeAddress } from '../../services/maps/geocodeAddress';
import DateOfBirthField from './DateOfBirthField';
import { Button } from '../ui/Button';
import Icon from '../ui/Icon';

const steps = ['Datos personales', 'Identificación y contacto', 'Ubicación de tu tienda', 'Coordenadas y moneda', 'Acceso y wallet'];
const documentTypes = {
  CO: ['Cédula de ciudadanía', 'Cédula de extranjería', 'NIT', 'Pasaporte'],
  MX: ['CURP', 'RFC', 'INE', 'Pasaporte'], AR: ['DNI', 'CUIT', 'CUIL', 'Pasaporte'],
  BR: ['CPF', 'CNPJ', 'RG', 'Pasaporte'], CL: ['RUT', 'RUN', 'Pasaporte'],
  PE: ['DNI', 'RUC', 'Carné de extranjería', 'Pasaporte'], EC: ['Cédula', 'RUC', 'Pasaporte'],
  PA: ['Cédula', 'RUC', 'Pasaporte'], DO: ['Cédula', 'RNC', 'Pasaporte'],
  US: ['SSN', 'EIN', 'ITIN', 'Pasaporte'], CA: ['SIN', 'Business Number', 'Pasaporte'], ES: ['DNI', 'NIE', 'NIF', 'Pasaporte'],
};

export default function SellerRegistrationFields({ values, onChange, pending = false, navigationTarget }) {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState(0);
  const [geocoding, setGeocoding] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [locationError, setLocationError] = useState('');
  const [dateError, setDateError] = useState('');
  const fieldsRef = useRef(null);
  const isLastStep = step === steps.length - 1;
  const countryNames = new Intl.DisplayNames([i18n.language], { type: 'region' });
  const countryOptions = sellerCountries.map(({ code }) => ({ code, name: countryNames.of(code) })).sort((a, b) => a.name.localeCompare(b.name, i18n.language));
  const docs = documentTypes[values.country] || ['Documento nacional de identidad', 'Documento de identidad fiscal', 'Pasaporte'];

  function setValue(name, value) { onChange({ target: { name, value } }); }
  function changeCountry(event) {
    onChange(event);
    const nextDocs = documentTypes[event.target.value] || ['Documento nacional de identidad', 'Documento de identidad fiscal', 'Pasaporte'];
    setValue('documentType', nextDocs[0]);
    setValue('storeCity', ''); setValue('latitude', ''); setValue('longitude', '');
    setLocationMessage(''); setLocationError('');
  }
  async function resolveCoordinates() {
    setGeocoding(true); setLocationError(''); setLocationMessage(t('Buscando las coordenadas de la dirección…'));
    try {
      const location = await geocodeAddress(values.storeAddress, values.storeCity, values.country);
      setValue('storeCity', location.city); setValue('latitude', String(location.latitude)); setValue('longitude', String(location.longitude));
      setLocationMessage(t('Ubicación encontrada: {{city}}', { city: location.city }));
    } catch (cause) {
      setLocationMessage('');
      const message = cause.message === 'GEOCODER_UNAVAILABLE' ? 'No pudimos consultar el servicio de ubicación. Revisa tu conexión e inténtalo de nuevo.' : 'No encontramos esa dirección. Añade ciudad y país a la dirección e inténtalo de nuevo.';
      setLocationError(t(message));
    } finally { setGeocoding(false); }
  }
  function next() {
    if (step === 0 && !values.dateOfBirth) { setDateError(t('Selecciona tu fecha de nacimiento para continuar.')); return; }
    const invalid = fieldsRef.current?.querySelector(':invalid');
    if (invalid) { invalid.reportValidity(); return; }
    goToStep(Math.min(step + 1, steps.length - 1));
  }
  function goToStep(nextStep) {
    setStep(nextStep);
    requestAnimationFrame(() => fieldsRef.current?.closest('.account-page__content, .app-screen')?.scrollTo({ top: 0, behavior: 'smooth' }));
  }
  function preventImplicitSubmit(event) { if (event.key === 'Enter' && event.target.tagName !== 'BUTTON') event.preventDefault(); }
  const textField = (name, label, min, max, options = {}) => <label htmlFor={`seller-${name}`} key={name}>{t(label)}<input id={`seller-${name}`} name={name} required minLength={min || undefined} maxLength={max} value={values[name]} onChange={onChange} {...options} /></label>;

  const navigation = <div className="seller-registration__navigation">{step > 0 && <Button type="button" variant="secondary" disabled={pending || geocoding} onClick={() => goToStep(step - 1)}>{t('Anterior')}</Button>}{!isLastStep && <Button type="button" disabled={pending || geocoding} icon="arrowRight" onClick={next}>{t('Siguiente')}</Button>}{isLastStep && <Button type="submit" form={navigationTarget ? 'account-form' : undefined} disabled={pending || geocoding} icon="arrowRight">{pending ? t('Un momento…') : t('Crear cuenta de vendedor')}</Button>}</div>;

  return <fieldset className="seller-registration" onKeyDown={preventImplicitSubmit}>
    <legend className="visually-hidden">{t('Registro de vendedor')}</legend>
    <div className="seller-registration__progress" aria-live="polite"><span>{t('Paso {{current}} de {{total}}', { current: step + 1, total: steps.length })}</span><div role="progressbar" aria-label={t('Progreso del registro')} aria-valuemin="1" aria-valuemax={steps.length} aria-valuenow={step + 1}><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div><h2>{t(steps[step])}</h2></div>
    <div className="seller-registration__fields" ref={fieldsRef}>
      {step === 0 && <>
        {textField('name', 'Tu nombre', 2, 70, { autoComplete: 'name', placeholder: t('¿Cómo te llamas?') })}
        <DateOfBirthField value={values.dateOfBirth} error={dateError} onChange={event => { onChange(event); setDateError(''); }} />
        <label htmlFor="seller-country">{t('País')}<select id="seller-country" name="country" required value={values.country} onChange={changeCountry}>{countryOptions.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
      </>}
      {step === 1 && <>
        <label htmlFor="seller-document-type">{t('Tipo de documento')}<select id="seller-document-type" name="documentType" required value={values.documentType} onChange={onChange}>{docs.map(type => <option key={type}>{type}</option>)}</select></label>
        {textField('documentNumber', 'Número de documento', 3, 40, { autoComplete: 'off' })}
        <label htmlFor="account-email">{t('Correo electrónico')}<input id="account-email" name="email" type="email" required autoComplete="email" value={values.email} onChange={onChange} placeholder={t('tu@correo.com')} /></label>
      </>}
      {step === 2 && <>
        {textField('storeName', 'Nombre de la tienda', 2, 80, { autoComplete: 'organization' })}
        <label htmlFor="seller-city">{t('Ciudad de la tienda')}<input id="seller-city" name="storeCity" required minLength={2} maxLength={80} autoComplete="address-level2" value={values.storeCity} onChange={event => { onChange(event); setLocationMessage(''); setLocationError(''); setValue('latitude', ''); setValue('longitude', ''); }} placeholder={t('Escribe ciudad')} /></label>
        <label htmlFor="seller-address">{t('Dirección de la tienda')}<input id="seller-address" name="storeAddress" required minLength={5} maxLength={200} autoComplete="street-address" value={values.storeAddress} onChange={event => { onChange(event); setLocationMessage(''); setLocationError(''); setValue('latitude', ''); setValue('longitude', ''); }} placeholder={t('Escribe la dirección dentro de la ciudad')} /></label>
      </>}
      {step === 3 && <>
        <div className="seller-location-lookup"><small>{t('Usaremos ciudad, dirección y país para encontrar las coordenadas de tu tienda.')}</small>
          <Button type="button" variant="secondary" disabled={pending || geocoding || !values.storeCity.trim() || !values.storeAddress.trim()} onClick={resolveCoordinates}>{geocoding ? t('Buscando…') : t('Obtener latitud y longitud')}</Button>
        </div>
        <div className="seller-coordinate-fields"><label htmlFor="seller-latitude">{t('Latitud')}<input id="seller-latitude" name="latitude" type="number" required min="-90" max="90" step="any" value={values.latitude} onChange={event => { onChange(event); setLocationMessage(''); setLocationError(''); }} placeholder="6.2442" /></label><label htmlFor="seller-longitude">{t('Longitud')}<input id="seller-longitude" name="longitude" type="number" required min="-180" max="180" step="any" value={values.longitude} onChange={event => { onChange(event); setLocationMessage(''); setLocationError(''); }} placeholder="-75.5812" /></label>
        </div>
        {locationMessage && <small role="status">{locationMessage}</small>}
        {locationError && <small className="seller-location-error" role="alert">{locationError}</small>}
      </>}
      {step === 4 && <>
        <label htmlFor="account-password">{t('Contraseña')}<input id="account-password" name="password" type="password" required minLength={8} autoComplete="new-password" value={values.password} onChange={onChange} placeholder={t('Al menos 8 caracteres')} /></label>
        <div className="seller-receiving-wallet"><div className="wallet-form-heading"><span className="wallet-icon-tile"><Icon name="wallet" /></span><div><h2>{t('Recibe tus pagos')}</h2><p>{t('Configura la wallet y la moneda de tu tienda.')}</p></div></div>
          <label htmlFor="seller-currency">{t('Moneda para recibir pagos')}<select id="seller-currency" name="storeCurrency" required value={values.storeCurrency} onChange={onChange}><option value="COP">{t('COP · Peso colombiano')}</option><option value="USD">{t('USD · Dólar estadounidense')}</option></select></label>
          <label htmlFor="seller-receiving-address">{t('Wallet de tu tienda · Open Payments')}<input id="seller-receiving-address" name="storeWalletAddress" type="text" required value={values.storeWalletAddress} onChange={onChange} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="$ilp.interledger-test.dev/tu-tienda" aria-describedby="seller-receiving-help" /></label>
        <small id="seller-receiving-help">{t('Ingresa el Payment Pointer o la dirección HTTPS de tu wallet.')}</small>
        </div>
      </>}
    </div>
    {navigationTarget ? createPortal(navigation, navigationTarget) : navigation}
  </fieldset>;
}
