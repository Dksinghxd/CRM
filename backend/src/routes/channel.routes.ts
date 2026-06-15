import { Router } from 'express';
import { receiveReceipt, receiveBatchReceipts, channelHealth } from '../controllers/channel.controller';

const router = Router();

// These endpoints are called by the channel service (no auth required for receipt)
// Security: In production, add HMAC signature verification from channel service

// Single receipt (callback from channel service)
router.post('/receipt', receiveReceipt);

// Batch receipts
router.post('/receipt/batch', receiveBatchReceipts);

// Health check (no auth)
router.get('/health', channelHealth);

export default router;
