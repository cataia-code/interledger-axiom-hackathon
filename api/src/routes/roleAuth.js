import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { config } from '../config/index.js';
import { HttpError } from '../middlewares/errorHandler.js';
import * as c from '../controllers/roleAuthController.js';

// Se monta antes del handler de Better Auth, por eso cada ruta parsea su propio JSON:
// un express.json() global consumiría el cuerpo de las rutas que atiende Better Auth.
export function createRoleAuthRouter({ max = config.roleAuthRateLimitMax } = {}) {
  const router = Router();
  const json = express.json();
  // Better Auth no limita las llamadas internas, así que estas rutas llevan su propio límite.
  const limit = () =>
    rateLimit({
      windowMs: 60_000,
      limit: max,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      validate: config.env !== 'test', // los tests envían X-Forwarded-For sin proxy real
      handler: (req, res, next) => next(new HttpError(429, 'Too many requests. Please try again later.', 'RATE_LIMITED')),
    });

  router.post('/buyer/sign-up', limit(), json, c.buyerSignUp);
  router.post('/buyer/sign-in', limit(), json, c.buyerSignIn);
  router.post('/buyer/sign-in/otp', limit(), json, c.buyerSignInOtp);
  router.post('/seller/sign-up', limit(), json, c.sellerSignUp);
  router.post('/seller/sign-in', limit(), json, c.sellerSignIn);
  router.post('/seller/sign-in/otp', limit(), json, c.sellerSignInOtp);
  return router;
}
