import { Router } from 'express';
import { z } from 'zod';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  importCustomers,
  getSampleCustomers,
  getCustomerStats,
} from '../controllers/customer.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

const createCustomerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  city: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  age: z.union([z.number().int().min(0).max(150), z.string()]).optional(),
  tags: z.array(z.string()).optional(),
});

const updateCustomerSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  age: z.union([z.number().int().min(0).max(150), z.string()]).optional(),
  tags: z.array(z.string()).optional(),
});

const importSchema = z.object({
  customers: z.array(
    z.object({
      name: z.string(),
      email: z.string().email(),
      phone: z.string().optional(),
      city: z.string().optional(),
      gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
      age: z.union([z.number(), z.string()]).optional(),
      tags: z.array(z.string()).optional(),
    })
  ),
});

// Special routes before /:id
router.get('/stats', getCustomerStats);
router.get('/sample', getSampleCustomers);
router.post('/import', validateBody(importSchema), importCustomers);

// CRUD routes
router.get('/', getCustomers);
router.post('/', validateBody(createCustomerSchema), createCustomer);
router.get('/:id', getCustomerById);
router.put('/:id', validateBody(updateCustomerSchema), updateCustomer);
router.delete('/:id', deleteCustomer);

export default router;
