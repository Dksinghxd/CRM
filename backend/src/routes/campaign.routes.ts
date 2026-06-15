import { Router } from 'express';
import { z } from 'zod';
import {
  getCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  launchCampaignController,
  getCampaignCommunications,
  duplicateCampaign,
} from '../controllers/campaign.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';

const router = Router();

router.use(authMiddleware);

const createCampaignSchema = z.object({
  name: z.string().min(2).max(200),
  segmentId: z.string().optional(),
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH']),
  subject: z.string().max(200).optional(),
  message: z.string().min(1, 'Message is required'),
  headline: z.string().max(200).optional(),
  cta: z.string().max(100).optional(),
  goal: z.string().optional(),
  tone: z.string().optional(),
  scheduledAt: z.string().optional(),
  status: z.enum(['DRAFT', 'SCHEDULED']).optional(),
});

const updateCampaignSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  segmentId: z.string().nullable().optional(),
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH']).optional(),
  subject: z.string().max(200).nullable().optional(),
  message: z.string().min(1).optional(),
  headline: z.string().max(200).nullable().optional(),
  cta: z.string().max(100).nullable().optional(),
  goal: z.string().nullable().optional(),
  tone: z.string().nullable().optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'PAUSED']).optional(),
  scheduledAt: z.string().nullable().optional(),
});

// CRUD
router.get('/', getCampaigns);
router.post('/', validateBody(createCampaignSchema), createCampaign);
router.get('/:id', getCampaignById);
router.put('/:id', validateBody(updateCampaignSchema), updateCampaign);
router.delete('/:id', deleteCampaign);

// Actions
router.post('/:id/launch', launchCampaignController);
router.post('/:id/duplicate', duplicateCampaign);
router.get('/:id/communications', getCampaignCommunications);

export default router;
