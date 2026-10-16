import {
  closeStore,
  getSellerContext,
  presentOrganization,
  presentStore,
  updateOrganization,
  updateStore,
} from '../services/sellerService.js';

const wrap = (fn) => async (req, res, next) => {
  try {
    res.json(await fn(req));
  } catch (err) {
    next(err);
  }
};

export const getOrganization = wrap(async (req) => ({
  organization: presentOrganization((await getSellerContext(req.auth.user.id)).organization),
}));
export const patchOrganization = wrap(async (req) => ({
  organization: presentOrganization(await updateOrganization(req.auth.user.id, req.body)),
}));
export const getOwnStore = wrap(async (req) => ({ store: presentStore((await getSellerContext(req.auth.user.id)).store) }));
export const patchOwnStore = wrap(async (req) => ({ store: presentStore(await updateStore(req.auth.user.id, req.body)) }));
export const deleteOwnStore = wrap(async (req) => ({ store: presentStore(await closeStore(req.auth.user.id)) }));
