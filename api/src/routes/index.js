import { Router } from 'express';
import { getHealth } from '../controllers/healthController.js';
import { getPing } from '../controllers/pingController.js';
import { getMe } from '../controllers/meController.js';
import { postStore } from '../controllers/storeController.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.get('/health', getHealth);
router.get('/ping', getPing);
router.get('/me', requireAuth, getMe);
router.post('/stores', requireAuth, postStore);

export default router;
