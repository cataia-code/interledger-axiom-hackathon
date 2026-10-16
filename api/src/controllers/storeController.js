import { createStore } from '../services/storeService.js';
import { HttpError } from '../middlewares/errorHandler.js';

function parseStoreInput(body = {}) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 2 || name.length > 80) {
    throw new HttpError(400, 'name must be between 2 and 80 characters', 'INVALID_NAME');
  }
  let description = null;
  if (body.description != null) {
    if (typeof body.description !== 'string' || body.description.trim().length > 500) {
      throw new HttpError(400, 'description must be a string of at most 500 characters', 'INVALID_DESCRIPTION');
    }
    description = body.description.trim() || null;
  }
  return { name, description };
}

export async function postStore(req, res, next) {
  try {
    const input = parseStoreInput(req.body);
    const { store, role } = await createStore(req.auth.user.id, input);
    res.status(201).json({
      store: { id: store.id, name: store.name, description: store.description, createdAt: store.createdAt },
      user: { id: req.auth.user.id, role },
    });
  } catch (err) {
    next(err);
  }
}
