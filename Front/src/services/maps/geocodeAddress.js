import { getMapConfig, loadGoogleMaps } from './loaders';

const cache = new Map();
let lastPublicSearchAt = 0;

const addressKey = (address, country) => `${country.toLowerCase()}:${address.trim().toLowerCase()}`;

function cityFromGoogle(components) {
  return components.find(item => item.types.includes('locality'))?.long_name
    || components.find(item => item.types.includes('sublocality'))?.long_name
    || components.find(item => item.types.includes('administrative_area_level_2'))?.long_name
    || components.find(item => item.types.includes('administrative_area_level_1'))?.long_name
    || '';
}

export async function geocodeAddress(address, city, country) {
  const normalizedAddress = address.trim();
  const normalizedCity = city.trim();
  const query = [normalizedAddress, normalizedCity].filter(Boolean).join(', ');
  const key = addressKey(query, country);
  if (cache.has(key)) return cache.get(key);

  const { googleMapsApiKey } = await getMapConfig();
  let location;
  if (googleMapsApiKey) {
    try {
      const maps = await loadGoogleMaps(googleMapsApiKey);
      const result = await new Promise((resolve, reject) => new maps.Geocoder().geocode(
        { address: `${query}, ${country}`, componentRestrictions: { country: country.toLowerCase() } },
        (results, status) => status === 'OK' && results?.length ? resolve(results[0]) : reject(new Error('ADDRESS_NOT_FOUND')),
      ));
      const point = result.geometry.location;
      location = { city: cityFromGoogle(result.address_components || []) || normalizedCity, latitude: point.lat(), longitude: point.lng() };
    } catch {
      // A missing or invalid Google key falls back to the public, low-volume geocoder.
    }
  }

  if (!location) {
    const wait = Math.max(0, 1100 - (Date.now() - lastPublicSearchAt));
    if (wait) await new Promise(resolve => window.setTimeout(resolve, wait));
    lastPublicSearchAt = Date.now();
    const params = new URLSearchParams({ q: `${query}, ${country}`, countrycodes: country.toLowerCase(), format: 'jsonv2', addressdetails: '1', limit: '1' });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('GEOCODER_UNAVAILABLE');
    const [place] = await response.json();
    if (!place) throw new Error('ADDRESS_NOT_FOUND');
    const addressParts = place.address || {};
    location = {
      city: addressParts.city || addressParts.town || addressParts.village || addressParts.municipality || addressParts.county || addressParts.state || normalizedCity,
      latitude: Number(place.lat), longitude: Number(place.lon),
    };
  }

  if (!location.city || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) throw new Error('ADDRESS_NOT_FOUND');
  cache.set(key, location);
  return location;
}
