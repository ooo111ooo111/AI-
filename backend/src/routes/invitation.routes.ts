import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getInvitationStatus, redeemInvitationCode } from '../controllers/invitation.controller';

const router = Router();

router.use(requireAuth);
router.get('/status', getInvitationStatus);
router.post('/redeem', redeemInvitationCode);

export default router;
