import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { protect } from '../middleware/auth.middleware';
import { checkRole } from '../middleware/rbac.middleware';

const router = Router();

// ALL user routes are protected, so protect them at the start.
router.use(protect);

// --- Admin Only Routes ---
router.get('/', checkRole(['ADMIN']), userController.getAll);
router.put('/:id', checkRole(['ADMIN']), userController.update);
router.delete('/:id', checkRole(['ADMIN']), userController.remove);

// --- General Protected Routes ---
router.get('/search', userController.search);
router.get('/:id', userController.getById);
router.post('/invite', userController.invite);

export default router;