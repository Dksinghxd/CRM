import { Router } from 'express';
import { z } from 'zod';
import {
  getOrders,
  getOrderById,
  getOrdersByCustomer,
  getOrderAnalytics,
  createOrder,
  updateOrder,
  deleteOrder,
} from '../controllers/order.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';

const router = Router();

router.use(authMiddleware);

const createOrderSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  amount: z.union([z.number().positive(), z.string()]),
  category: z.string().min(1, 'Category is required'),
  channel: z.enum(['ONLINE', 'OFFLINE', 'MOBILE_APP']).optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED']).optional(),
  purchaseDate: z.string().optional(),
});

const updateOrderSchema = z.object({
  status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED']).optional(),
  amount: z.union([z.number().positive(), z.string()]).optional(),
  category: z.string().optional(),
});

// Analytics and special routes first
router.get('/analytics', getOrderAnalytics);
router.get('/customer/:customerId', getOrdersByCustomer);

// CRUD
router.get('/', getOrders);
router.post('/', validateBody(createOrderSchema), createOrder);
router.get('/:id', getOrderById);
router.put('/:id', validateBody(updateOrderSchema), updateOrder);
router.delete('/:id', deleteOrder);

export default router;
