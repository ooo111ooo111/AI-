import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { listHotTweets } from '../controllers/hotspot.controller';

const router = Router();

router.use(requireAuth);
router.get('/tweets', listHotTweets);

export default router;
