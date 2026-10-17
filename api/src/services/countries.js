// Países oficiales (ISO 3166-1 alpha-2). Se guarda el código; el nombre en español se calcula al responder.
const CODES = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW
SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(/\s+/);

const es = new Intl.DisplayNames(['es'], { type: 'region' });
const en = new Intl.DisplayNames(['en'], { type: 'region' });

const normalize = (text) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export const COUNTRIES = CODES.map((code) => ({ code, name: es.of(code) })).sort((a, b) => a.name.localeCompare(b.name, 'es'));

const names = new Map(); // nombre normalizado → código (español, inglés y alias comunes)
for (const code of CODES) {
  names.set(normalize(es.of(code)), code);
  names.set(normalize(en.of(code)), code);
}
for (const [alias, code] of [['usa', 'US'], ['eeuu', 'US'], ['ee uu', 'US'], ['gran bretana', 'GB'], ['holanda', 'NL']]) names.set(alias, code);

const known = new Set(CODES);

// Acepta un código de 2 letras o el nombre del país (español o inglés); devuelve el código o null.
export function resolveCountry(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (/^[A-Za-z]{2}$/.test(v)) return known.has(v.toUpperCase()) ? v.toUpperCase() : null;
  return names.get(normalize(v)) ?? null;
}

export const countryName = (code) => (code && known.has(code) ? es.of(code) : null);
