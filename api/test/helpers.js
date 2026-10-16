import request from 'supertest';
import app from '../src/app.js';

export const PASSWORD = 'Password-12345';
let n = 0;
export const uniq = () => `${Date.now()}${n++}`;
export const authed = (req, token) => req.set('Authorization', `Bearer ${token}`);
export const post = (path, body) => request(app).post(`/api/v1/auth${path}`).send(body);

export const sellerBody = (email, extra = {}) => ({
  email,
  password: PASSWORD,
  name: 'Owner',
  organization: {
    legalName: 'Panadería Luna S.A.',
    taxId: `TAX-${uniq()}`,
    legalId: `LEG-${uniq()}`,
    country: 'PA',
    legalAddress: 'Calle 50, Ciudad de Panamá',
  },
  store: {
    name: 'Sucursal Centro',
    address: 'Av. Central 123',
    city: 'Panamá',
    latitude: 8.98,
    longitude: -79.51,
    legalId: `SUC-${uniq()}`,
    currency: 'USD',
    ...extra,
  },
});

// Crea un seller (con organización y sucursal) y devuelve la respuesta del registro.
export async function newSeller(domain, extra) {
  const res = await post('/seller/sign-up', sellerBody(`s${uniq()}@${domain}`, extra));
  if (res.status !== 201) throw new Error(`seller sign-up failed: ${JSON.stringify(res.body)}`);
  return res.body;
}

export async function newBuyer(domain) {
  const res = await post('/buyer/sign-up', { email: `b${uniq()}@${domain}`, password: PASSWORD, name: 'Buyer' });
  if (res.status !== 201) throw new Error(`buyer sign-up failed: ${JSON.stringify(res.body)}`);
  return res.body;
}
