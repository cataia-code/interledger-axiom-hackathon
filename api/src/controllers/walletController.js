import * as wallets from '../services/walletService.js';

const run = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (err) {
    next(err);
  }
};

export const list = run(async (req, res) => res.json({ wallets: await wallets.listWallets(req.auth.user.id) }));
export const create = run(async (req, res) => res.status(201).json({ wallet: await wallets.addWallet(req.auth.user.id, req.body) }));
export const patch = run(async (req, res) => res.json({ wallet: await wallets.updateWallet(req.auth.user.id, req.params.id, req.body) }));
export const remove = run(async (req, res) => {
  await wallets.removeWallet(req.auth.user.id, req.params.id);
  res.status(204).end();
});
