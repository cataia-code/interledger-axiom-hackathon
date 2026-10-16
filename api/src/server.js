import app from './app.js';
import { config } from './config/index.js';
import { expireReservations } from './services/stockService.js';
import { cancelExpiredOrders } from './services/orderService.js';

const server = app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port} (${config.env})`);
});

// Cada minuto: cancela pedidos sin pagar a tiempo y marca como vencidas las reservas pasadas.
const reservationJob = setInterval(() => {
  cancelExpiredOrders()
    .then(() => expireReservations())
    .catch((err) => console.error('[jobs] expiry failed', err));
}, 60_000);
reservationJob.unref();

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
