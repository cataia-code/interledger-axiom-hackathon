import { config } from '../config/index.js';
import { placeholder } from './placeholder.js';
import { openpayments } from './openpayments.js';

const providers = { placeholder, openpayments };

// Proveedor activo. Interfaz común: refund. placeholder: createPayment, verifyWebhook. openpayments: resolveWallet, begin, complete.
export const provider = providers[config.paymentProvider];
if (!provider) throw new Error(`Unknown PAYMENT_PROVIDER "${config.paymentProvider}" (use placeholder or openpayments)`);
