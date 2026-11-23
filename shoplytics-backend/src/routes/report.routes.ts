import { Router } from 'express';
import * as ctrl from '../controllers/report.controller';
import { P } from '../constants/permissions';
import { authorize } from '../middleware/authorize';
import { limiters } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { exportReportQuery, generateReportSchema, listReportsQuery, reportParam } from '../validators/report.validator';

// Mounted at /api/v1/businesses/:businessId/reports
const router = Router({ mergeParams: true });

router.get('/', authorize(P.REPORT_READ), validate({ query: listReportsQuery }), ctrl.list);
router.get('/types', authorize(P.REPORT_READ), ctrl.catalog);
router.post('/generate', authorize(P.REPORT_GENERATE), limiters.heavy, validate({ body: generateReportSchema }), ctrl.generate);
router.get('/:reportId', authorize(P.REPORT_READ), validate({ params: reportParam }), ctrl.get);
router.get('/:reportId/export', authorize(P.REPORT_EXPORT), limiters.heavy, validate({ params: reportParam, query: exportReportQuery }), ctrl.exportReport);
router.delete('/:reportId', authorize(P.REPORT_DELETE), validate({ params: reportParam }), ctrl.remove);

export default router;
