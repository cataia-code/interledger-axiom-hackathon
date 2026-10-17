// Carga datos de ejemplo usando la propia API (sirve contra local o Railway).
// Uso: API_URL=https://<host> npm run seed   (por defecto http://localhost:3000)
// Por defecto carga 3 tiendas con 5 ítems cada una; SEED_STORES (máx. 6) y SEED_ITEMS (máx. 8) lo ajustan.
import sharp from 'sharp';

const BASE = `${process.env.API_URL ?? 'http://localhost:3000'}/api/v1`;
const PASSWORD = 'Password-12345';

// `form` (FormData) sube archivos; `body` se envía como JSON.
async function call(method, path, { token, body, form } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
    body: form ?? (body && JSON.stringify(body)),
  });
  if (res.status === 429) {
    // Registro e inicio de sesión admiten 5 intentos por minuto y ruta: esperamos y reintentamos.
    console.log('… límite de peticiones, esperando 62 s');
    await new Promise((r) => setTimeout(r, 62_000));
    return call(method, path, { token, body, form });
  }
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

// ---- imágenes de relleno (generadas, no hay fotos reales) ----
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const wrap = (text, max) => {
  const lines = [];
  for (const word of text.split(' ')) {
    if (lines.length && `${lines.at(-1)} ${word}`.length <= max) lines[lines.length - 1] += ` ${word}`;
    else lines.push(word);
  }
  return lines;
};
function placeholder(width, height, [c1, c2], title, subtitle = '') {
  const size = Math.round(Math.min(width, height) / (width > height * 2 ? 6 : 9));
  const lines = wrap(title, width > height * 2 ? 28 : 14);
  const y0 = height / 2 - ((lines.length - 1) * size * 1.2) / 2;
  const text = lines.map((l, i) => `<text x="50%" y="${y0 + i * size * 1.2}" font-size="${size}" font-weight="700" text-anchor="middle" fill="#fff" font-family="Helvetica, Arial, sans-serif">${esc(l)}</text>`).join('');
  const sub = subtitle ? `<text x="50%" y="${height - size}" font-size="${Math.round(size * 0.55)}" text-anchor="middle" fill="#ffffffcc" font-family="Helvetica, Arial, sans-serif">${esc(subtitle)}</text>` : '';
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>${text}${sub}</svg>`)).png().toBuffer();
}
const initials = (name) => name.split(' ').filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
async function upload(method, path, token, png) {
  const form = new FormData();
  form.append('image', new Blob([png], { type: 'image/png' }), 'seed.png');
  const r = await call(method, path, { token, form });
  if (r.status >= 300) throw new Error(`${method} ${path} ${r.status}: ${JSON.stringify(r.data)}`);
}

// Registra la cuenta; si ya existe (422), inicia sesión. Devuelve el token.
async function account(role, signUpBody) {
  const up = await call('POST', `/auth/${role}/sign-up`, { body: { country: 'CO', ...signUpBody } });
  if (up.status === 201) return up.data.token;
  if (up.status !== 422) throw new Error(`${role} sign-up ${up.status}: ${JSON.stringify(up.data)}`);
  const inn = await call('POST', `/auth/${role}/sign-in`, { body: { email: signUpBody.email, password: PASSWORD } });
  if (inn.status !== 200) throw new Error(`${role} sign-in ${inn.status}: ${JSON.stringify(inn.data)}`);
  // Cuentas creadas antes de existir el país: se lo ponemos.
  if (!inn.data.user.country) await call('PATCH', '/me', { token: inn.data.token, body: { country: 'CO' } });
  return inn.data.token;
}

// Precios en pesos (COP); la API los guarda en unidades menores (×100).
const COP = (pesos) => pesos * 100;

const store = (n, name, description, address, latitude, longitude) => ({
  name, description, address, city: 'Medellín', latitude, longitude, legalId: `DEMO-MDE-SUC-${n}`, currency: 'COP',
});
const org = (n, legalName, tradeName) => ({
  legalName, tradeName, taxId: `DEMO-MDE-TAX-${n}`, legalId: `DEMO-MDE-RM-${n}`, country: 'CO', legalAddress: `Medellín, Antioquia (demo ${n})`,
});

// items: [sku, nombre, descripción, precio COP, categoría, stock, descuento?]
const PALETTES = [['#c2410c', '#f59e0b'], ['#4b2e1e', '#a16207'], ['#15803d', '#84cc16'], ['#1d4ed8', '#7c3aed'], ['#b45309', '#dc2626'], ['#be185d', '#16a34a']];

const SELLERS = [
  {
    email: 'panaderia.poblado@example.com', name: 'Camila Restrepo',
    organization: org(1, 'Panadería El Poblado S.A.S.', 'Panadería El Poblado'),
    store: store(1, 'Panadería El Poblado', 'Pan artesanal, almojábanas y repostería recién horneada.', 'Carrera 35 #8A-40, El Poblado', 6.2088, -75.567),
    categories: ['Panes', 'Pastelería', 'Bebidas'],
    items: [
      ['POB-001', 'Pan de bono (6 unidades)', 'Clásico antioqueño de queso y almidón de yuca.', 9000, 'Panes', 50],
      ['POB-002', 'Almojábana', 'Suave y con queso costeño.', 2500, 'Panes', 80],
      ['POB-003', 'Pan de masa madre', 'Fermentación lenta de 24 horas.', 14000, 'Panes', 25],
      ['POB-004', 'Croissant de mantequilla', 'Hojaldre dorado y crujiente.', 6500, 'Pastelería', 40, { type: 'percent', value: 1000 }],
      ['POB-005', 'Torta de chocolate (porción)', 'Con ganache de cacao 70 %.', 8500, 'Pastelería', 30],
      ['POB-006', 'Brazo de reina', 'Relleno de arequipe y mermelada de mora.', 7500, 'Pastelería', 20],
      ['POB-007', 'Jugo natural de lulo', 'Hecho al momento, 400 ml.', 6000, 'Bebidas', 35],
      ['POB-008', 'Chocolate santafereño', 'Con queso para sumergir.', 7000, 'Bebidas', 28],
    ],
  },
  {
    email: 'cafe.laureles@example.com', name: 'Andrés Gómez',
    organization: org(2, 'Café Laureles S.A.S.', 'Café Laureles'),
    store: store(2, 'Café Laureles', 'Café de especialidad de fincas antioqueñas, tostado en casa.', 'Circular 4 #70-15, Laureles', 6.2442, -75.59),
    categories: ['Café en grano', 'Accesorios', 'Preparados'],
    items: [
      ['LAU-001', 'Café Supremo 250 g', 'Notas de panela y chocolate.', 28000, 'Café en grano', 60],
      ['LAU-002', 'Café Geisha 250 g', 'Floral y cítrico, lote limitado.', 85000, 'Café en grano', 15],
      ['LAU-003', 'Café de Jardín 500 g', 'Caramelo y frutos rojos.', 48000, 'Café en grano', 35, { type: 'fixed', value: 4000 }],
      ['LAU-004', 'Prensa francesa 600 ml', 'Vidrio borosilicato.', 65000, 'Accesorios', 12],
      ['LAU-005', 'Molino manual de café', 'Muelas de cerámica ajustables.', 120000, 'Accesorios', 8],
      ['LAU-006', 'Filtros V60 (100 unidades)', 'Papel blanqueado sin cloro.', 22000, 'Accesorios', 40],
      ['LAU-007', 'Cold brew 355 ml', 'Concentrado listo para tomar.', 11000, 'Preparados', 45],
      ['LAU-008', 'Capuchino para llevar', 'Doble shot, leche de la región.', 8500, 'Preparados', 70],
    ],
  },
  {
    email: 'mercado.belen@example.com', name: 'Luz Marina Ospina',
    organization: org(3, 'Mercado Campesino Belén S.A.S.', 'Mercado Campesino Belén'),
    store: store(3, 'Mercado Campesino Belén', 'Frutas, verduras y productos de campo directo de las veredas.', 'Carrera 76 #30-25, Belén', 6.23, -75.605),
    categories: ['Frutas', 'Verduras', 'Despensa'],
    items: [
      ['BEL-001', 'Mora de Castilla (500 g)', 'Fresca, ideal para jugos y postres.', 7000, 'Frutas', 40],
      ['BEL-002', 'Lulo (kg)', 'Ácido y aromático.', 9500, 'Frutas', 30],
      ['BEL-003', 'Aguacate Hass (unidad)', 'Maduro y cremoso.', 4500, 'Frutas', 60, { type: 'percent', value: 1500 }],
      ['BEL-004', 'Tomate de árbol (kg)', 'Para jugo o salsa.', 6500, 'Frutas', 35],
      ['BEL-005', 'Plátano maduro (4 unidades)', 'Para patacones y tajadas.', 5000, 'Verduras', 50],
      ['BEL-006', 'Cilantro y cebolla larga', 'Mazo fresco de la vereda.', 2000, 'Verduras', 80],
      ['BEL-007', 'Frijol cargamanto (500 g)', 'Para el plato típico paisa.', 8500, 'Despensa', 45],
      ['BEL-008', 'Panela en bloque (1 kg)', 'Panela artesanal de trapiche.', 6000, 'Despensa', 55],
    ],
  },
  {
    email: 'libreria.carlos@example.com', name: 'Julián Mejía',
    organization: org(4, 'Librería Carlos E. S.A.S.', 'Librería Carlos E.'),
    store: store(4, 'Librería Carlos E.', 'Libros de autores colombianos, papelería y arte.', 'Calle 50 #73-20, Carlos E. Restrepo', 6.237, -75.58),
    categories: ['Libros', 'Papelería', 'Arte'],
    items: [
      ['LIB-001', 'Cien años de soledad', 'Gabriel García Márquez, edición de bolsillo.', 42000, 'Libros', 25],
      ['LIB-002', 'El olvido que seremos', 'Héctor Abad Faciolince.', 49000, 'Libros', 18],
      ['LIB-003', 'La virgen de los sicarios', 'Fernando Vallejo.', 38000, 'Libros', 15],
      ['LIB-004', 'Cuaderno argollado 100 hojas', 'Pasta dura, rayado.', 9500, 'Papelería', 90],
      ['LIB-005', 'Set de 12 esferos de colores', 'Punta fina 0.7 mm.', 15000, 'Papelería', 60, { type: 'percent', value: 2000 }],
      ['LIB-006', 'Agenda 2027', 'Vista semanal, tapa de cuero.', 35000, 'Papelería', 30],
      ['LIB-007', 'Acuarelas profesionales (24)', 'Pigmentos de alta cobertura.', 78000, 'Arte', 14],
      ['LIB-008', 'Block de dibujo A3', '40 hojas, 150 g.', 18000, 'Arte', 40],
    ],
  },
  {
    email: 'artesanias.centro@example.com', name: 'Sofía Cardona',
    organization: org(5, 'Artesanías del Centro S.A.S.', 'Artesanías del Centro'),
    store: store(5, 'Artesanías del Centro', 'Artesanía antioqueña hecha a mano: cuero, cerámica y tejidos.', 'Carrera 51 #52-10, La Candelaria', 6.2518, -75.5636),
    categories: ['Accesorios', 'Hogar', 'Recuerdos'],
    items: [
      ['ART-001', 'Carriel antioqueño', 'Cuero de res y pelo de res, hecho a mano.', 180000, 'Accesorios', 10],
      ['ART-002', 'Mochila arhuaca', 'Tejida a mano en lana y algodón.', 150000, 'Accesorios', 12],
      ['ART-003', 'Sombrero aguadeño', 'Fibra de iraca, tejido tradicional.', 95000, 'Accesorios', 15, { type: 'fixed', value: 10000 }],
      ['ART-004', 'Poncho paisa', 'Lana virgen, diseño clásico.', 130000, 'Accesorios', 9],
      ['ART-005', 'Olla de barro (mediana)', 'Cerámica de La Chamba.', 60000, 'Hogar', 20],
      ['ART-006', 'Hamaca de algodón', 'Tejida a mano, doble.', 110000, 'Hogar', 8],
      ['ART-007', 'Imán Pueblito Paisa', 'Cerámica pintada a mano.', 8000, 'Recuerdos', 100],
      ['ART-008', 'Réplica del Metro de Medellín', 'Escultura en madera.', 45000, 'Recuerdos', 22],
    ],
  },
  {
    email: 'floristeria.prado@example.com', name: 'Valentina Arango',
    organization: org(6, 'Floristería y Vivero Prado S.A.S.', 'Floristería Prado'),
    store: store(6, 'Floristería Prado', 'Flores frescas, plantas y arreglos para toda ocasión.', 'Calle 58 #50-30, Prado Centro', 6.2605, -75.5658),
    categories: ['Flores', 'Plantas', 'Insumos'],
    items: [
      ['FLO-001', 'Ramo de rosas (12)', 'Rosas rojas de exportación.', 55000, 'Flores', 30],
      ['FLO-002', 'Ramo de girasoles (6)', 'Alegres y de tallo largo.', 40000, 'Flores', 25],
      ['FLO-003', 'Orquídea en matera', 'Phalaenopsis, flor de larga duración.', 70000, 'Flores', 18, { type: 'percent', value: 1000 }],
      ['FLO-004', 'Monstera deliciosa', 'Planta de interior, maceta 20 cm.', 65000, 'Plantas', 14],
      ['FLO-005', 'Suculentas surtidas (3)', 'Con matera de cerámica.', 30000, 'Plantas', 40],
      ['FLO-006', 'Helecho de Boston', 'Ideal para colgar.', 28000, 'Plantas', 22],
      ['FLO-007', 'Tierra abonada (5 kg)', 'Mezcla para materas.', 15000, 'Insumos', 50],
      ['FLO-008', 'Maceta de barro n.º 3', 'Con plato.', 12000, 'Insumos', 60],
    ],
  },
];

const STORES = Math.min(Number(process.env.SEED_STORES) || 3, SELLERS.length);
const ITEMS = Math.min(Number(process.env.SEED_ITEMS) || 5, 8);

for (const [index, s] of SELLERS.slice(0, STORES).entries()) {
  const palette = PALETTES[index % PALETTES.length];
  const token = await account('seller', { email: s.email, password: PASSWORD, name: s.name, organization: s.organization, store: s.store });
  const existing = await call('GET', '/seller/categories', { token });
  const catIds = new Map(existing.data.categories.map((c) => [c.name, c.id]));
  for (const name of s.categories) {
    if (catIds.has(name)) continue;
    const r = await call('POST', '/seller/categories', { token, body: { name } });
    catIds.set(name, r.data.category.id);
  }

  // Banner e icono de la tienda (solo si faltan).
  const mine = (await call('GET', '/seller/store', { token })).data.store;
  if (!mine.bannerUrl) await upload('PUT', '/seller/store/banner', token, await placeholder(1600, 600, palette, s.store.name, 'Medellín, Colombia'));
  if (!mine.iconUrl) await upload('PUT', '/seller/store/icon', token, await placeholder(256, 256, palette, initials(s.store.name)));

  // Ítems existentes por SKU, para no duplicar ni repetir imágenes.
  const owned = new Map((await call('GET', '/seller/items?limit=50', { token })).data.items.map((i) => [i.sku, i]));
  for (const [sku, name, description, priceAmount, cat, initialStock, discount] of s.items.slice(0, ITEMS)) {
    let item = owned.get(sku);
    if (item) {
      console.log(`= ${sku} ya existe`);
    } else {
      const r = await call('POST', '/seller/items', {
        token, body: { sku, name, description, priceAmount: COP(priceAmount), categoryId: catIds.get(cat), status: 'active', initialStock },
      });
      if (r.status !== 201) throw new Error(`item ${sku} ${r.status}: ${JSON.stringify(r.data)}`);
      item = r.data.item;
      if (discount) await call('POST', `/seller/items/${item.id}/discounts`, { token, body: discount.type === 'fixed' ? { ...discount, value: COP(discount.value) } : discount });
      console.log(`+ ${sku} ${name}`);
    }
    // 3 imágenes por producto, con un degradado distinto cada una.
    for (let n = (item.images ?? []).length + 1; n <= 3; n++) {
      const shifted = palette.map((c, k) => (n % 2 === 0 ? palette[1 - k] : c));
      await upload('POST', `/seller/items/${item.id}/images`, token, await placeholder(1024, 1024, shifted, name, `${s.store.name} · ${n}/3`));
    }
  }
}

await account('buyer', { email: 'comprador@example.com', password: PASSWORD, name: 'Compradora Demo' });
console.log(`\nVendedores: ${SELLERS.slice(0, STORES).map((x) => x.email).join(', ')}\nListo en ${BASE}\nCuentas (contraseña ${PASSWORD}): los vendedores (uno por tienda) y comprador@example.com (comprador)`);
