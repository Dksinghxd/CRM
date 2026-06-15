import { Router } from 'express';
import { z } from 'zod';
import {
  aiSegmentBuilder,
  aiMessageGenerator,
  aiPerformanceAnalyst,
  aiCopilot,
  aiCampaignNames,
} from '../controllers/ai.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';

const router = Router();

router.use(authMiddleware);

const segmentBuilderSchema = z.object({
  prompt: z.string().min(5, 'Prompt must be at least 5 characters').max(500),
  save: z.boolean().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
});

const messageGeneratorSchema = z.object({
  goal: z.string().min(5).max(300),
  audience: z.string().optional(),
  tone: z.enum(['formal', 'casual', 'urgent', 'friendly', 'professional']).optional(),
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH']).optional(),
});

const performanceAnalystSchema = z.object({
  campaignId: z.string().optional(),
  name: z.string().optional(),
  channel: z.string().optional(),
  totalSent: z.union([z.number(), z.string()]).optional(),
  totalDelivered: z.union([z.number(), z.string()]).optional(),
  totalOpened: z.union([z.number(), z.string()]).optional(),
  totalClicked: z.union([z.number(), z.string()]).optional(),
  totalConverted: z.union([z.number(), z.string()]).optional(),
  totalFailed: z.union([z.number(), z.string()]).optional(),
  segment: z.string().optional(),
  goal: z.string().optional(),
});

const copilotSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string().min(1),
    })
  ).min(1),
  includeContext: z.boolean().optional(),
});

const campaignNamesSchema = z.object({
  goal: z.string().min(3).max(200),
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH']).optional(),
});

router.post('/segment-builder', validateBody(segmentBuilderSchema), aiSegmentBuilder);
router.post('/message-generator', validateBody(messageGeneratorSchema), aiMessageGenerator);
router.post('/performance-analyst', validateBody(performanceAnalystSchema), aiPerformanceAnalyst);
router.post('/copilot', validateBody(copilotSchema), aiCopilot);
router.post('/campaign-names', validateBody(campaignNamesSchema), aiCampaignNames);

export default router;
