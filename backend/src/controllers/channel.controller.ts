import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../middleware/error.middleware';
import { updateCampaignStats } from '../services/campaign.service';
import { CommunicationStatus } from '@prisma/client';

// Status mapping from channel service events to our CommunicationStatus enum
const EVENT_TO_STATUS: Record<string, CommunicationStatus> = {
  sent: 'SENT',
  delivered: 'DELIVERED',
  failed: 'FAILED',
  opened: 'OPENED',
  read: 'READ',
  clicked: 'CLICKED',
  converted: 'CONVERTED',
};

// Status priority (higher index = higher priority, don't downgrade)
const STATUS_PRIORITY: Record<string, number> = {
  PENDING: 0,
  SENT: 1,
  DELIVERED: 2,
  FAILED: 2,
  OPENED: 3,
  READ: 4,
  CLICKED: 5,
  CONVERTED: 6,
};

// POST /api/channel/receipt
export const receiveReceipt = asyncHandler(async (req: Request, res: Response) => {
  const { communicationId, event, timestamp, metadata, externalId } = req.body;

  if (!communicationId || !event) {
    res.status(400).json({
      success: false,
      message: 'communicationId and event are required.',
    });
    return;
  }

  const normalizedEvent = event.toLowerCase().trim();
  const newStatus = EVENT_TO_STATUS[normalizedEvent];

  if (!newStatus) {
    res.status(400).json({
      success: false,
      message: `Unknown event type: ${event}. Valid events: ${Object.keys(EVENT_TO_STATUS).join(', ')}`,
    });
    return;
  }

  // Find the communication
  const communication = await prisma.communication.findUnique({
    where: { id: communicationId },
    select: { id: true, campaignId: true, status: true },
  });

  if (!communication) {
    // Acknowledge receipt even if not found (channel service retry prevention)
    res.status(200).json({
      success: true,
      message: 'Receipt acknowledged (communication not found).',
    });
    return;
  }

  // Only upgrade status, never downgrade (e.g., don't set SENT if already OPENED)
  const currentPriority = STATUS_PRIORITY[communication.status] ?? 0;
  const newPriority = STATUS_PRIORITY[newStatus] ?? 0;

  const updateData: Record<string, unknown> = {};
  if (newPriority > currentPriority) {
    updateData.status = newStatus;
  }
  if (externalId && !communication) {
    updateData.externalId = externalId;
  }

  // Always create the event record
  await prisma.communicationEvent.create({
    data: {
      communicationId,
      event: normalizedEvent,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      metadata: metadata || null,
    },
  });

  // Update communication status if changed
  if (Object.keys(updateData).length > 0) {
    await prisma.communication.update({
      where: { id: communicationId },
      data: updateData,
    });
  }

  // Update campaign aggregated stats (non-blocking)
  updateCampaignStats(communication.campaignId).catch((err: Error) => {
    console.error(
      `Failed to update campaign stats for ${communication.campaignId}:`,
      err.message
    );
  });

  res.status(200).json({
    success: true,
    message: 'Receipt processed successfully.',
    data: {
      communicationId,
      event: normalizedEvent,
      newStatus: newPriority > currentPriority ? newStatus : communication.status,
    },
  });
});

// POST /api/channel/receipt/batch
export const receiveBatchReceipts = asyncHandler(async (req: Request, res: Response) => {
  const { receipts } = req.body;

  if (!Array.isArray(receipts) || receipts.length === 0) {
    res.status(400).json({ success: false, message: 'receipts array is required.' });
    return;
  }

  const results = {
    processed: 0,
    errors: 0,
    skipped: 0,
  };

  const campaignIdsToUpdate = new Set<string>();

  for (const receipt of receipts) {
    try {
      const { communicationId, event, timestamp, metadata } = receipt;

      if (!communicationId || !event) {
        results.skipped++;
        continue;
      }

      const normalizedEvent = event.toLowerCase().trim();
      const newStatus = EVENT_TO_STATUS[normalizedEvent];

      if (!newStatus) {
        results.skipped++;
        continue;
      }

      const communication = await prisma.communication.findUnique({
        where: { id: communicationId },
        select: { id: true, campaignId: true, status: true },
      });

      if (!communication) {
        results.skipped++;
        continue;
      }

      campaignIdsToUpdate.add(communication.campaignId);

      const currentPriority = STATUS_PRIORITY[communication.status] ?? 0;
      const newPriority = STATUS_PRIORITY[newStatus] ?? 0;

      await prisma.communicationEvent.create({
        data: {
          communicationId,
          event: normalizedEvent,
          timestamp: timestamp ? new Date(timestamp) : new Date(),
          metadata: metadata || null,
        },
      });

      if (newPriority > currentPriority) {
        await prisma.communication.update({
          where: { id: communicationId },
          data: { status: newStatus },
        });
      }

      results.processed++;
    } catch {
      results.errors++;
    }
  }

  // Update all affected campaign stats
  for (const campaignId of campaignIdsToUpdate) {
    updateCampaignStats(campaignId).catch((err: Error) => {
      console.error(`Failed to update campaign stats for ${campaignId}:`, err.message);
    });
  }

  res.status(200).json({
    success: true,
    message: `Batch processed: ${results.processed} receipts, ${results.skipped} skipped, ${results.errors} errors.`,
    data: results,
  });
});

// GET /api/channel/health
export const channelHealth = asyncHandler(async (req: Request, res: Response) => {
  const { checkChannelServiceHealth } = await import('../services/channel.service');
  const health = await checkChannelServiceHealth();

  res.status(health.online ? 200 : 503).json({
    success: health.online,
    data: {
      channelService: health,
      backend: { status: 'online', timestamp: new Date().toISOString() },
    },
  });
});
