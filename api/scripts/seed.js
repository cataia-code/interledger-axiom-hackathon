// Carga datos de ejemplo usando la propia API (sirve contra local o Railway).
// Uso: API_URL=https://<host> npm run seed   (por defecto http://localhost:3000)
const BASE = `${process.env.API_URL ?? 'http://localhost:3000'}/api/v1`;
const PASSWORD = 'Password-12345';

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

// Registra la cuenta; si ya existe (422), inicia sesión. Devuelve el token.
async function account(role, signUpBody) {
  const up = await call('POST', `/auth/${role}/sign-up`, { body: signUpBody });
  if (up.status === 201) return up.data.token;
  if (up.status !== 422) throw new Error(`${role} sign-up ${up.status}: ${JSON.stringify(up.data)}`);
  const inn = await call('POST', `/auth/${role}/sign-in`, { body: { email: signUpBody.email, password: PASSWORD } });
  if (inn.status !== 200) throw new Error(`${role} sign-in ${inn.status}: ${JSON.stringify(inn.data)}`);
  return inn.data.token;
}

const SELLERS = [
  {
    email: 'panaderia.luna@example.com', name: 'Luna',
    organization: { legalName: 'Panadería Luna S.A.', tradeName: 'Panadería Luna', taxId: 'DEMO-TAX-001', legalId: 'DEMO-RM-001', country: 'PA', legalAddress: 'Calle 50, Ciudad de Panamá' },
    store: { name: 'Luna Centro', description: 'Pan artesanal y repostería del día.', address: 'Av. Central 123', city: 'Ciudad de Panamá', latitude: 8.98, longitude: -79.52, legalId: 'DEMO-SUC-001', currency: 'USD' },
    categories: ['Panes', 'Dulces'],
    items: [
      ['LUNA-001', 'Baguette artesanal', 'Crujiente por fuera, suave por dentro.', 250, 'Panes', 40],
      ['LUNA-002', 'Pan de masa madre', 'Fermentación lenta de 24 horas.', 650, 'Panes', 25],
      ['LUNA-003', 'Croissant de mantequilla', 'Hojaldre clásico francés.', 300, 'Dulces', 60, { type: 'percent', value: 1500 }],
      ['LUNA-004', 'Brownie de chocolate', 'Con nueces y cacao 70 %.', 400, 'Dulces', 30],
    ],
  },
  {
    email: 'cafe.alba@example.com', name: 'Alba',
    organization: { legalName: 'Café Alba S.R.L.', tradeName: 'Café Alba', taxId: 'DEMO-TAX-002', legalId: 'DEMO-RM-002', country: 'PA', legalAddress: 'Calle 8, Casco Antiguo' },
    store: { name: 'Alba Casco', description: 'Café de especialidad tostado en casa.', address: 'Calle 8 Este 45', city: 'Ciudad de Panamá', latitude: 8.95, longitude: -79.53, legalId: 'DEMO-SUC-002', currency: 'USD' },
    categories: ['Café', 'Accesorios'],
    items: [
      ['ALBA-001', 'Café Geisha 250 g', 'Notas florales y cítricas.', 2400, 'Café', 20],
      ['ALBA-002', 'Café Catuaí 500 g', 'Chocolate y caramelo.', 1800, 'Café', 35, { type: 'fixed', value: 200 }],
      ['ALBA-003', 'Prensa francesa', 'Vidrio borosilicato, 600 ml.', 2200, 'Accesorios', 12],
    ],
  },
];

for (const s of SELLERS) {
  const token = await account('seller', { email: s.email, password: PASSWORD, name: s.name, organization: s.organization, store: s.store });
  const existing = await call('GET', '/seller/categories', { token });
  const catIds = new Map(existing.data.categories.map((c) => [c.name, c.id]));
  for (const name of s.categories) {
    if (catIds.has(name)) continue;
    const r = await call('POST', '/seller/categories', { token, body: { name } });
    catIds.set(name, r.data.category.id);
  }
  for (const [sku, name, description, priceAmount, cat, initialStock, discount] of s.items) {
    const r = await call('POST', '/seller/items', {
      token, body: { sku, name, description, priceAmount, categoryId: catIds.get(cat), status: 'active', initialStock },
    });
    if (r.status === 409) { console.log(`= ${sku} ya existe`); continue; }
    if (r.status !== 201) throw new Error(`item ${sku} ${r.status}: ${JSON.stringify(r.data)}`);
    if (discount) await call('POST', `/seller/items/${r.data.item.id}/discounts`, { token, body: discount });
    console.log(`+ ${sku} ${name}`);
  }
}

await account('buyer', { email: 'comprador@example.com', password: PASSWORD, name: 'Compradora Demo' });
console.log(`\nListo en ${BASE}\nCuentas (contraseña ${PASSWORD}): panaderia.luna@example.com, cafe.alba@example.com (vendedores), comprador@example.com (comprador)`);
