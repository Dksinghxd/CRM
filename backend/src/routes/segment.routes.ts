import { Router } from 'express';
import { z } from 'zod';
import {
  getSegments,
  getSegmentById,
  createSegment,
  updateSegment,
  deleteSegment,
  evaluateSegmentById,
  previewSegment,
} from '../controllers/segment.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';

const router = Router();

router.use(authMiddleware);

const ruleSchema = z.object({
  field: z.string(),
  operator: z.string(),
  value: z.union([
    z.string(),
    z.number(),
    z.array(z.union([z.string(), z.number()])),
    z.boolean(),
  ]),
});

const createSegmentSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  rules: z.array(ruleSchema),
  operator: z.enum(['AND', 'OR']).optional(),
  aiGenerated: z.boolean().optional(),
  aiPrompt: z.string().optional(),
});

const updateSegmentSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  rules: z.array(ruleSchema).optional(),
  operator: z.enum(['AND', 'OR']).optional(),
});

const previewSchema = z.object({
  rules: z.array(ruleSchema),
  operator: z.enum(['AND', 'OR']).optional(),
});

// Special routes first
router.post('/preview', validateBody(previewSchema), previewSegment);

// CRUD
router.get('/', getSegments);
router.post('/', validateBody(createSegmentSchema), createSegment);
router.get('/:id', getSegmentById);
router.put('/:id', validateBody(updateSegmentSchema), updateSegment);
router.delete('/:id', deleteSegment);

// Evaluate
router.post('/:id/evaluate', evaluateSegmentById);

export default router;
