import * as service from '../services/roleAuthService.js';

const handler = (fn, status = 200) => async (req, res, next) => {
  try {
    res.status(status).json(await fn(req.body ?? {}));
  } catch (err) {
    next(err);
  }
};

export const buyerSignUp = handler(service.signUpBuyer, 201);
export const sellerSignUp = handler(service.signUpSeller, 201);
export const buyerSignIn = handler((b) => service.signInWithPassword('buyer', b));
export const sellerSignIn = handler((b) => service.signInWithPassword('seller', b));
export const buyerSignInOtp = handler((b) => service.signInWithCode('buyer', b));
export const sellerSignInOtp = handler((b) => service.signInWithCode('seller', b));
