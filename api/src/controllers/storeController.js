import { getPublicStore, listPublicStores, presentPublicStore } from '../services/sellerService.js';

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
