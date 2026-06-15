// ============================================================
// src/routes/channel.routes.ts
// Express router for all channel microservice endpoints
// ============================================================

import { Router } from 'express';
import {
  sendMessage,
  receiptWebhook,
  healthCheck,
  queueStatus,
} from '../controllers/channel.controller';

const router = Router();

// ─── Health Check ─────────────────────────────────────────────────────────────
// GET /health
router.get('/health', healthCheck);

// ─── Send Message ─────────────────────────────────────────────────────────────
// POST /send
// Body: SendMessagePayload
// Returns: { queueId, status: 'queued', communicationId, channel, message }
router.post('/send', sendMessage);

// ─── Receipt Webhook (internal stub) ─────────────────────────────────────────
// POST /receipt
// This endpoint is the internal callback target; listed for completeness
router.post('/receipt', receiptWebhook);

// ─── Queue Status ─────────────────────────────────────────────────────────────
// GET /queue/status
// Returns queue statistics and item details
router.get('/queue/status', queueStatus);

export default router;
