const router = require('express').Router();
const ctrl = require('../controllers/analyticsController');

/* Public: dashboards are open to everyone. */
router.get('/summary', ctrl.summary);
router.get('/charts', ctrl.charts);
router.get('/impact', ctrl.impact);

module.exports = router;
