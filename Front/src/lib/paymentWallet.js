// Payment Pointers resolve to HTTPS endpoints; bare hosts use /.well-known/pay.
// This checks the identifier's syntax, not provider compatibility or ownership.
export function normalizeWalletAddress(value) {
  try {
    const input = String(value).trim();
    if (!input || /[\s\\]/.test(input)) throw new Error();
    const pointer = input.startsWith('$');
    if (pointer && /[^\x21-\x7E]/.test(input)) throw new Error();
    const address = new URL(pointer ? `https://${input.slice(1)}` : input);
    if (address.protocol !== 'https:' || !address.hostname || address.username || address.password || address.search || address.hash || /[?#]/.test(input)) throw new Error();
    if (pointer) {
      const host = input.slice(1).split('/')[0];
      // A pointer has a host, not userinfo or an explicit port.
      if (!host || host.toLowerCase() !== address.hostname.toLowerCase() || address.port) throw new Error();
      if (address.pathname === '/') address.pathname = '/.well-known/pay';
    }
    return address.href;
  } catch { throw new Error('Ingresa un Payment Pointer como $ilp.interledger-test.dev/tu-wallet o una dirección HTTPS válida, sin claves, parámetros ni fragmentos.'); }
}
export function displayWalletAddress(value) {
  if (!value) return '';
  try {
    const address = new URL(normalizeWalletAddress(value));
    if (address.port) return address.href;
    return `$${address.hostname}${address.pathname === '/.well-known/pay' ? '' : address.pathname}`;
  } catch { return String(value); }
}
