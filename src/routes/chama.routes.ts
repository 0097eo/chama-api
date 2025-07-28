import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { checkMembership } from '../middleware/membership.middleware';
import * as validator from '../validators/chama.validators';
import * as chamaController from '../controllers/chama.controller';
import { uploadConstitution } from '../middleware/upload.midlleware';

const router = Router();

router.use(protect);

// POST /api/chamas - Create new chama. Uploads constitution to Cloudinary.
router.post(
  '/',
  uploadConstitution.single('constitution'), // 'constitution' is the form-data field name
  validator.createChamaValidator,
  chamaController.createChama
);

// GET /api/chamas - Get all chamas a user belongs to
router.get('/', chamaController.getUserChamas);

// GET /api/chamas/:id - Any member of the chama can view its details
router.get(
  '/:id',
  checkMembership(['ADMIN', 'TREASURER', 'SECRETARY', 'MEMBER']),
  chamaController.getChamaById
);

// PUT /api/chamas/:id - Only the chama ADMIN can update its details
router.put(
  '/:id',
  checkMembership(['ADMIN']),
  validator.updateChamaValidator,
  chamaController.updateChama
);

// DELETE /api/chamas/:id - Only the chama ADMIN can delete the chama
router.delete('/:id', checkMembership(['ADMIN']), chamaController.deleteChama);

// --- Member Management ---

// The `checkMembership(['ADMIN'])` ensures the person taking the action is an admin of that specific chama.
router.post('/:id/members', checkMembership(['ADMIN']), validator.inviteMemberValidator, chamaController.addMember);
router.delete('/:id/members/:userId', checkMembership(['ADMIN']), chamaController.removeMember);
router.put('/:id/members/:userId/role', checkMembership(['ADMIN']), validator.updateRoleValidator, chamaController.updateMemberRole);

// --- Dashboard ---
router.get('/:id/dashboard', checkMembership(['ADMIN', 'TREASURER', 'SECRETARY', 'MEMBER']), chamaController.getChamaDashboard);

export default router;