import { Router } from 'express';
import {
  getDashboard,
  getCampaignAnalytics,
  getRevenueAnalytics,
  getCustomerAnalytics,
} from '../controllers/analytics.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/dashboard', getDashboard);
router.get('/campaigns', getCampaignAnalytics);
router.get('/revenue', getRevenueAnalytics);
router.get('/customers', getCustomerAnalytics);

export default router;
