const router = require('express').Router();
const ctrl = require('../controllers/reportController');
const { requireAuth, requireRole } = require('../middleware/auth');

const STAFF = ['official', 'administrator'];

/* Any signed-in user can submit and track their own reports. */
router.post('/', requireAuth, ctrl.createReport);
router.get('/mine', requireAuth, ctrl.myReports);

/* Officials see the cross-citizen queue (PII stripped by the controller). */
router.get('/', requireAuth, requireRole(...STAFF), ctrl.listReports);

router.get('/:id', requireAuth, ctrl.getReport);
router.patch('/:id/status', requireAuth, requireRole(...STAFF), ctrl.updateStatus);
router.patch('/:id/response', requireAuth, requireRole(...STAFF), ctrl.updateResponse);

/* Photo evidence: owner (or official) attaches an image after submission.
   Ownership is checked BEFORE multer writes anything to disk. */
router.post('/:id/images', requireAuth, ctrl.requireReportUploader, ctrl.uploadReportImage, ctrl.addImage);

module.exports = router;
