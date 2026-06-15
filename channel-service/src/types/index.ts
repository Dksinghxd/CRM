// ============================================================
// src/types/index.ts
// All shared TypeScript types for the Channel Microservice
// ============================================================

export type Channel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH';

export type DeliveryEvent =
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED'
  | 'OPENED'
  | 'READ'
  | 'CLICKED'
  | 'CONVERTED';

export type QueueItemStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'DEAD_LETTER';

// ─── Incoming Send Payload ────────────────────────────────────────────────────

export interface SendMessagePayload {
  communicationId: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  channel: Channel;
  message: string;
  subject?: string;
}

// ─── Internal Queue Item ──────────────────────────────────────────────────────

export interface QueueItem {
  queueId: string;
  payload: SendMessagePayload;
  status: QueueItemStatus;
  attempt: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Callback Payload sent to Backend ────────────────────────────────────────

export interface CallbackPayload {
  communicationId: string;
  event: string;
  timestamp: string;
  metadata: {
    channel: Channel;
    attempt: number;
    customerId?: string;
    customerEmail?: string;
    customerName?: string;
    subject?: string;
  };
}

// ─── Queue Stats ──────────────────────────────────────────────────────────────

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  deadLetter: number;
  total: number;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface SendResponse {
  queueId: string;
  status: 'queued';
  communicationId: string;
  channel: Channel;
  message: string;
}

export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
  queue: QueueStats;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}
