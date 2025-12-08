import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { checkMembership } from '../middleware/membership.middleware';
import * as contributionController from '../controllers/contribution.controller';
import * as contributionValidator from '../validators/contributions.validators';
import { uploadCsv } from '../middleware/upload.midlleware'; // For bulk import

const router = Router();

// All contribution routes are protected and require a logged-in user
router.use(protect);

// POST /api/contributions - Record a new contribution payment
router.post(
  '/',
  contributionValidator.recordContributionValidator,
  contributionController.recordContribution
);

// POST /api/contributions/bulk-import/:chamaId -Only Admin/Treasurer can bulk import from CSV
router.post(
  '/bulk-import/:chamaId',
  checkMembership(['ADMIN', 'TREASURER']),
  uploadCsv.single('contributionsFile'),
  contributionController.bulkImportContributions
);

// GET /api/contributions/chama/:chamaId - Get all contributions for a specific chama
router.get(
  '/chama/:chamaId',
  checkMembership(['ADMIN', 'TREASURER', 'SECRETARY', 'MEMBER']),
  contributionController.getChamaContributions
);

// GET /api/contributions/member/:membershipId - Get all contributions for a specific member
router.get(
  '/member/:membershipId',
  // A user should only be able to see their own contributions, or an admin can see any
  contributionController.getMemberContributions
);

// GET /api/contributions/summary/:chamaId - Admin/Treasurer/Secretary can view summary
router.get(
  '/summary/:chamaId',
  checkMembership(['ADMIN', 'TREASURER', 'SECRETARY']),
  contributionController.getContributionSummary
);

// GET /api/contributions/defaulters/:chamaId - Admin/Treasurer/Secretary can view defaulters
router.get(
  '/defaulters/:chamaId',
  checkMembership(['ADMIN', 'TREASURER', 'SECRETARY']),
  contributionController.getDefaulters
);

// GET /api/contributions/export/:chamaId - Admin/Treasurer/Secretary can export data
router.get(
  '/export/:chamaId',
  checkMembership(['ADMIN', 'TREASURER', 'SECRETARY']),
  contributionController.exportContributions
);

// A single contribution can be identified by its unique ID
router.get('/:id', contributionController.getContributionById);

// PUT /api/contributions/:id - Update a contribution record (e.g., correct a typo)
router.put(
  '/:id',
  contributionValidator.updateContributionValidator,
  contributionController.updateContribution
);

// DELETE /api/contributions/:id - Delete a contribution (requires high privilege)
router.delete('/:id', contributionController.deleteContribution);


export default router;