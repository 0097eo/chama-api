import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { checkMembership } from '../middleware/membership.middleware';
import * as fileController from '../controllers/file.controller';
import { uploadGenericFile } from '../middleware/upload.midlleware';
import { MembershipRole } from '@prisma/client';

const router = Router();
router.use(protect);

const allMembers = Object.values(MembershipRole);

// POST /api/files/upload/:chamaId - Any member can upload a file to their chama
router.post(
    '/upload/:chamaId',
    checkMembership(allMembers),
    uploadGenericFile.single('file'), // 'file' is the form-data field name
    fileController.uploadFile
);

// GET /api/files/chama/:chamaId - Any member can get a list of their chama's files
router.get(
    '/chama/:chamaId',
    checkMembership(allMembers),
    fileController.getChamaFiles
);

// GET /api/files/:id - Any member can get a file's details (and URL)
router.get('/:id', fileController.getFileDetails);

// DELETE /api/files/:id - Only Admin/Secretary can delete a file
router.delete('/:id', fileController.deleteFile);


export default router;