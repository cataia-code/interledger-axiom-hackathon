import { validateStoreInput } from '../services/storeService.js';
import { addStore, presentStore } from '../services/sellerService.js';

export async function postStore(req, res, next) {
  try {
    const input = validateStoreInput(req.body);
    const created = await addStore(req.auth.user.id, input);
    res.status(201).json({ store: presentStore(created) });
  } catch (err) {
    next(err);
  }
}
