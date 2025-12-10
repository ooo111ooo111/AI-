import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { listUsers } from '../controllers/admin.controller';
import {
  generateInvitationCodes,
  listInvitationCodes,
  deleteInvitationCode,
  exportInvitationCodes
} from '../controllers/invitation.controller';

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);
router.get('/users', listUsers);
router.post('/invitations/generate', generateInvitationCodes);
router.get('/invitations', listInvitationCodes);
router.delete('/invitations/:id', deleteInvitationCode);
router.get('/invitations/export', exportInvitationCodes);

export default router;
