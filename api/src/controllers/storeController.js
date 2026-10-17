import { getPublicStore, listPublicStores, presentPublicStore } from '../services/sellerService.js';
import { getGeneralStats, getStoreStats } from '../services/statsService.js';

export async function getStore(req, res, next) {
  try {
    res.json({ store: presentPublicStore(await getPublicStore(req.params.id)) });
  } catch (err) {
    next(err);
  }
}

export async function listStores(req, res, next) {
  try {
    res.json(await listPublicStores(req.query));
  } catch (err) {
    next(err);
  }
}

// Estadísticas públicas: se pueden cachear un minuto.
const cached = (res) => res.set('Cache-Control', 'public, max-age=60');

export async function storeStats(req, res, next) {
  try {
    res.json({ stats: await getStoreStats(await getPublicStore(req.params.id)) });
  } catch (err) {
    next(err);
  }
}

export async function generalStats(req, res, next) {
  try {
    res.json({ stats: await getGeneralStats(req.query) });
  } catch (err) {
    next(err);
  }
}

export const publicStatsCache = (req, res, next) => {
  cached(res);
  next();
};
