import { Router } from 'express';
import { getHealth } from '../controllers/healthController.js';
import { getPing } from '../controllers/pingController.js';

const router = Router();

router.get('/health', getHealth);
router.get('/ping', getPing);

export default router;
