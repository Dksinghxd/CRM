// ============================================================
// src/controllers/channel.controller.ts
// Request handlers for all channel endpoints
// ============================================================

import { Request, Response } from 'express';
import { enqueue, getQueueStats, getAllQueueItems } from '../services/queue.service';
import {
  SendMessagePayload,
  SendResponse,
  HealthResponse,
  ErrorResponse,
  Channel,
} from '../types';

// ─── Valid Channels ───────────────────────────────────────────────────────────

const VALID_CHANNELS: Channel[] = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'];

// ─── POST /send ───────────────────────────────────────────────────────────────

export async function sendMessage(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const body = req.body as Partial<SendMessagePayload>;

    // ── Validation ─────────────────────────────────────────────────────────

    const requiredFields: (keyof SendMessagePayload)[] = [
      'communicationId',
      'customerId',
      'customerEmail',
      'customerName',
      'channel',
      'message',
    ];

    const missingFields = requiredFields.filter(
      (field) => body[field] === undefined || body[field] === null || body[field] === ''
    );

    if (missingFields.length > 0) {
      const error: ErrorResponse = {
        error: 'VALIDATION_ERROR',
        message: `Missing required fields: ${missingFields.join(', ')}`,
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    if (!VALID_CHANNELS.includes(body.channel as Channel)) {
      const error: ErrorResponse = {
        error: 'VALIDATION_ERROR',
        message: `Invalid channel "${body.channel}". Must be one of: ${VALID_CHANNELS.join(', ')}`,
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    // Email format basic check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.customerEmail as string)) {
      const error: ErrorResponse = {
        error: 'VALIDATION_ERROR',
        message: `Invalid customerEmail format: "${body.customerEmail}"`,
        statusCode: 400,
      };
      res.status(400).json(error);
      return;
    }

    // ── Build Payload ──────────────────────────────────────────────────────

    const payload: SendMessagePayload = {
      communicationId: body.communicationId as string,
      customerId: body.customerId as string,
      customerEmail: body.customerEmail as string,
      customerName: body.customerName as string,
      channel: body.channel as Channel,
      message: body.message as string,
      ...(body.subject ? { subject: body.subject } : {}),
    };

    // ── Enqueue ────────────────────────────────────────────────────────────

    const queueItem = enqueue(payload);

    const response: SendResponse = {
      queueId: queueItem.queueId,
      status: 'queued',
      communicationId: payload.communicationId,
      channel: payload.channel,
      message: `Message queued for delivery via ${payload.channel}`,
    };

    res.status(202).json(response);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    console.error('[CONTROLLER] sendMessage error:', err);
    const error: ErrorResponse = {
      error: 'INTERNAL_ERROR',
      message: errorMsg,
      statusCode: 500,
    };
    res.status(500).json(error);
  }
}

// ─── POST /receipt ────────────────────────────────────────────────────────────
// Internal stub endpoint — not used externally, present for completeness

export async function receiptWebhook(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;

    console.log('[CONTROLLER] /receipt called with body:', JSON.stringify(body, null, 2));

    res.status(200).json({
      status: 'received',
      timestamp: new Date().toISOString(),
      payload: body,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    console.error('[CONTROLLER] receiptWebhook error:', err);
    const error: ErrorResponse = {
      error: 'INTERNAL_ERROR',
      message: errorMsg,
      statusCode: 500,
    };
    res.status(500).json(error);
  }
}

// ─── GET /health ──────────────────────────────────────────────────────────────

export function healthCheck(req: Request, res: Response): void {
  const stats = getQueueStats();

  const response: HealthResponse = {
    status: 'ok',
    service: 'channel-service',
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    queue: stats,
  };

  res.status(200).json(response);
}

// ─── GET /queue/status ────────────────────────────────────────────────────────

export function queueStatus(req: Request, res: Response): void {
  const { active, deadLetter, stats } = getAllQueueItems();

  res.status(200).json({
    stats,
    activeItems: active.map((item) => ({
      queueId: item.queueId,
      communicationId: item.payload.communicationId,
      channel: item.payload.channel,
      status: item.status,
      attempt: item.attempt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    deadLetterItems: deadLetter.map((item) => ({
      queueId: item.queueId,
      communicationId: item.payload.communicationId,
      channel: item.payload.channel,
      status: item.status,
      attempt: item.attempt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    timestamp: new Date().toISOString(),
  });
}
