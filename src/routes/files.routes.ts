import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { checkMembership } from '../middleware/membership.middleware';
import * as fileController from '../controllers/file.controller';
import { uploadGenericFile } from '../middleware/upload.midlleware';
import { MembershipRole } from '@prisma/client';

const router = Router();
router.use(protect);

const allMembers = Object.values(MembershipRole);

/**
 * @swagger
 * /files/upload/{chamaId}:
 *   post:
 *     tags: [Files]
 *     summary: Upload file to chama
 *     description: Uploads a document or file to the chama storage. All members can upload.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chamaId
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File to upload (max 10MB). Supports PDF, DOC, DOCX, XLS, XLSX, JPG, PNG
 *               category:
 *                 type: string
 *                 enum: [MINUTES, FINANCIAL_REPORT, CONSTITUTION, MEMBER_DOCUMENT, OTHER]
 *                 example: MINUTES
 *                 description: Optional file category for organization
 *     responses:
 *       201:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: File uploaded successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: cmdjw3rr50002cuhv9312yj79
 *                     filename:
 *                       type: string
 *                       example: meeting-minutes-jan-2025.pdf
 *                     url:
 *                       type: string
 *                       format: uri
 *                       example: https://res.cloudinary.com/demo/image/upload/v1234567890/sample.pdf
 *                     publicId:
 *                       type: string
 *                       example: chama-files/abc123def456
 *                       description: Cloudinary public ID for the file
 *                     fileType:
 *                       type: string
 *                       example: application/pdf
 *                       description: MIME type of the file
 *                     size:
 *                       type: integer
 *                       example: 2048576
 *                       description: File size in bytes
 *                     category:
 *                       type: string
 *                       nullable: true
 *                       example: MINUTES
 *                     chamaId:
 *                       type: string
 *                       example: cmdjw3rr50002cuhv9312yj79
 *                     uploaderId:
 *                       type: string
 *                       example: cmdjw3rr50002cuhv9312yj79
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid file type or file too large
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Not a member of this chama
 *       413:
 *         description: File size exceeds limit (10MB)
 */
router.post(
    '/upload/:chamaId',
    checkMembership(allMembers),
    uploadGenericFile.single('file'),
    fileController.uploadFile
);

/**
 * @swagger
 * /files/chama/{chamaId}:
 *   get:
 *     tags: [Files]
 *     summary: Get chama files
 *     description: Returns list of all files uploaded to the chama. All members can view.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chamaId
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [MINUTES, FINANCIAL_REPORT, CONSTITUTION, MEMBER_DOCUMENT, OTHER]
 *         description: Filter by file category
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in file title and description
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [uploadedAt, fileName, fileSize]
 *           default: uploadedAt
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Files retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: cmdjw3rr50002cuhv9312yj79
 *                       filename:
 *                         type: string
 *                         example: meeting-minutes-jan-2025.pdf
 *                       category:
 *                         type: string
 *                         nullable: true
 *                         example: MINUTES
 *                       url:
 *                         type: string
 *                         format: uri
 *                       size:
 *                         type: integer
 *                         description: File size in bytes
 *                       fileType:
 *                         type: string
 *                         example: application/pdf
 *                       uploadedBy:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Not a member of this chama
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
    '/chama/:chamaId',
    checkMembership(allMembers),
    fileController.getChamaFiles
);

/**
 * @swagger
 * /files/{id}:
 *   get:
 *     tags: [Files]
 *     summary: Get file details
 *     description: Returns detailed information about a specific file including download URL
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *     responses:
 *       200:
 *         description: File details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: cmdjw3rr50002cuhv9312yj79
 *                     filename:
 *                       type: string
 *                       example: meeting-minutes-jan-2025.pdf
 *                     category:
 *                       type: string
 *                       nullable: true
 *                       example: MINUTES
 *                     url:
 *                       type: string
 *                       format: uri
 *                       description: Cloudinary URL for file access
 *                     publicId:
 *                       type: string
 *                       description: Cloudinary public ID
 *                     size:
 *                       type: integer
 *                       description: File size in bytes
 *                     fileType:
 *                       type: string
 *                       example: application/pdf
 *                     chamaId:
 *                       type: string
 *                     uploaderId:
 *                       type: string
 *                     uploadedBy:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         firstName:
 *                           type: string
 *                         lastName:
 *                           type: string
 *                         email:
 *                           type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Access denied - not a member of this chama
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', fileController.getFileDetails);

/**
 * @swagger
 * /files/{id}:
 *   delete:
 *     tags: [Files]
 *     summary: Delete file
 *     description: |
 *       Permanently deletes a file from chama storage. Admin/Secretary only.
 *       
 *       This operation:
 *       - Removes the file from Cloudinary storage
 *       - Deletes the file record from the database
 *       - Cannot be undone
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *         description: File ID to delete
 *     responses:
 *       200:
 *         description: File deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: File deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin or Secretary access required
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/:id', fileController.deleteFile);

export default router;