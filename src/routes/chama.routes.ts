import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { checkMembership } from '../middleware/membership.middleware';
import * as validator from '../validators/chama.validators';
import * as chamaController from '../controllers/chama.controller';
import { uploadConstitution } from '../middleware/upload.midlleware';

const router = Router();

router.use(protect);

/**
 * @swagger
 * /chamas:
 *   post:
 *     tags: [Chamas]
 *     summary: Create a new chama
 *     description: Creates a new chama group with constitution document upload. Creator automatically becomes admin.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - monthlyContribution
 *               - meetingDay
 *             properties:
 *               name:
 *                 type: string
 *                 example: Savings Group A
 *               description:
 *                 type: string
 *                 example: Monthly savings and investment group
 *               monthlyContribution:
 *                 type: number
 *                 description: Monthly contribution amount in KES
 *                 example: 5000
 *               meetingDay:
 *                 type: string
 *                 description: Meeting day schedule
 *                 example: First Friday of every month
 *               constitution:
 *                 type: string
 *                 format: binary
 *                 description: PDF constitution document (max 5MB)
 *     responses:
 *       201:
 *         description: Chama created successfully
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
 *                   example: Chama created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: cmdjw3rr50002cuhv9312yj79
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     monthlyContribution:
 *                       type: number
 *                     meetingDay:
 *                       type: string
 *                     registrationNumber:
 *                       type: string
 *                       description: Auto-generated unique registration number
 *                       example: CHM-123456
 *                     constitutionUrl:
 *                       type: string
 *                       format: uri
 *                       nullable: true
 *                     totalMembers:
 *                       type: integer
 *                       example: 1
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       413:
 *         description: File too large
 */
router.post(
  '/',
  uploadConstitution.single('constitution'),
  validator.createChamaValidator,
  chamaController.createChama
);

/**
 * @swagger
 * /chamas:
 *   get:
 *     tags: [Chamas]
 *     summary: Get user's chamas
 *     description: Returns all chamas the authenticated user belongs to with member details
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Chamas retrieved successfully
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
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       monthlyContribution:
 *                         type: number
 *                       meetingDay:
 *                         type: string
 *                       registrationNumber:
 *                         type: string
 *                       constitutionUrl:
 *                         type: string
 *                         format: uri
 *                         nullable: true
 *                       totalMembers:
 *                         type: integer
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       members:
 *                         type: array
 *                         description: Active members only
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             userId:
 *                               type: string
 *                             chamaId:
 *                               type: string
 *                             role:
 *                               type: string
 *                               enum: [ADMIN, TREASURER, SECRETARY, MEMBER]
 *                             isActive:
 *                               type: boolean
 *                             joinedAt:
 *                               type: string
 *                               format: date-time
 *                             user:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: string
 *                                 firstName:
 *                                   type: string
 *                                 lastName:
 *                                   type: string
 *                                 email:
 *                                   type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/', chamaController.getUserChamas);

/**
 * @swagger
 * /chamas/{id}:
 *   get:
 *     tags: [Chamas]
 *     summary: Get chama details
 *     description: Returns detailed information about a specific chama including all active members. Requires membership.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *         description: Chama ID
 *     responses:
 *       200:
 *         description: Chama details retrieved successfully
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
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     monthlyContribution:
 *                       type: number
 *                     meetingDay:
 *                       type: string
 *                     registrationNumber:
 *                       type: string
 *                     constitutionUrl:
 *                       type: string
 *                       format: uri
 *                       nullable: true
 *                     totalMembers:
 *                       type: integer
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     members:
 *                       type: array
 *                       description: Active members sorted by role
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           userId:
 *                             type: string
 *                           chamaId:
 *                             type: string
 *                           role:
 *                             type: string
 *                             enum: [ADMIN, TREASURER, SECRETARY, MEMBER]
 *                           isActive:
 *                             type: boolean
 *                           joinedAt:
 *                             type: string
 *                             format: date-time
 *                           user:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               firstName:
 *                                 type: string
 *                               lastName:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                               phone:
 *                                 type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Not a member of this chama
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  '/:id',
  checkMembership(['ADMIN', 'TREASURER', 'SECRETARY', 'MEMBER']),
  chamaController.getChamaById
);

/**
 * @swagger
 * /chamas/{id}:
 *   put:
 *     tags: [Chamas]
 *     summary: Update chama details
 *     description: Updates chama information. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               monthlyContribution:
 *                 type: number
 *                 description: Monthly contribution amount in KES
 *               meetingDay:
 *                 type: string
 *                 description: Meeting day schedule
 *     responses:
 *       200:
 *         description: Chama updated successfully
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
 *                   example: Chama updated successfully
 *                 data:
 *                   type: object
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin access required
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
  '/:id',
  checkMembership(['ADMIN']),
  validator.updateChamaValidator,
  chamaController.updateChama
);

/**
 * @swagger
 * /chamas/{id}:
 *   delete:
 *     tags: [Chamas]
 *     summary: Delete chama
 *     description: Permanently deletes a chama and all associated data. Admin only.
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
 *         description: Chama deleted successfully
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
 *                   example: Chama deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin access required
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/:id', checkMembership(['ADMIN']), chamaController.deleteChama);

// --- Member Management ---

/**
 * @swagger
 * /chamas/{id}/members:
 *   post:
 *     tags: [Chamas]
 *     summary: Add member to chama
 *     description: Adds a new member to the chama by email. User must already be registered. Member is automatically assigned 'MEMBER' role. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userEmail
 *             properties:
 *               userEmail:
 *                 type: string
 *                 format: email
 *                 description: Email of the user to add (must be registered)
 *                 example: newmember@example.com
 *     responses:
 *       201:
 *         description: Member added successfully
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
 *                   example: Member added successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     userId:
 *                       type: string
 *                     chamaId:
 *                       type: string
 *                     role:
 *                       type: string
 *                       example: MEMBER
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: User not found or validation error
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin access required
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       409:
 *         description: User is already a member
 */
router.post('/:id/members', checkMembership(['ADMIN']), validator.inviteMemberValidator, chamaController.addMember);

/**
 * @swagger
 * /chamas/{id}/members/{userId}:
 *   delete:
 *     tags: [Chamas]
 *     summary: Remove member from chama
 *     description: Removes a member from the chama. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *         description: ID of the user to remove
 *     responses:
 *       200:
 *         description: Member removed successfully
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
 *                   example: Member removed successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Member not found
 */
router.delete('/:id/members/:userId', checkMembership(['ADMIN']), chamaController.removeMember);

/**
 * @swagger
 * /chamas/{id}/members/{userId}/role:
 *   put:
 *     tags: [Chamas]
 *     summary: Update member role
 *     description: Changes a member's role in the chama. Cannot demote the last admin. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *         description: ID of the user whose role to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [ADMIN, TREASURER, SECRETARY, MEMBER]
 *                 example: TREASURER
 *     responses:
 *       200:
 *         description: Role updated successfully
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
 *                   example: Role updated successfully
 *                 data:
 *                   type: object
 *       400:
 *         description: Cannot demote last admin or validation error
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Member not found
 */
router.put('/:id/members/:userId/role', checkMembership(['ADMIN']), validator.updateRoleValidator, chamaController.updateMemberRole);

// --- Dashboard ---

/**
 * @swagger
 * /chamas/{id}/dashboard:
 *   get:
 *     tags: [Chamas]
 *     summary: Get chama dashboard
 *     description: Returns comprehensive dashboard data including member count, contributions, and loans for the current year
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
 *         description: Dashboard data retrieved successfully
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
 *                     totalMembers:
 *                       type: integer
 *                       description: Total active members
 *                       example: 25
 *                     totalContributionsThisYear:
 *                       type: number
 *                       description: Sum of all paid contributions for current year
 *                       example: 1500000
 *                     activeLoansCount:
 *                       type: integer
 *                       description: Number of currently active loans
 *                       example: 3
 *                     totalLoanAmountActive:
 *                       type: number
 *                       description: Total amount of active loans
 *                       example: 250000
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Not a member of this chama
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id/dashboard', checkMembership(['ADMIN', 'TREASURER', 'SECRETARY', 'MEMBER']), chamaController.getChamaDashboard);

export default router;