import { config } from '../config/index.js';
import { placeholder } from './placeholder.js';

const providers = { placeholder };

// Proveedor activo. Interfaz: createPayment, refund, verifyWebhook.
export const provider = providers[config.paymentProvider];
