// ============================================================
// src/services/queue.service.ts
// In-memory queue with concurrency control, retry, dead letter
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { QueueItem, QueueItemStatus, QueueStats, SendMessagePayload } from '../types';
import { simulateDelivery } from './simulator.service';

// ─── Configuration ────────────────────────────────────────────────────────────

const MAX_CONCURRENCY = 10;
const MAX_RETRY_ATTEMPTS = 3;

// ─── Queue State ──────────────────────────────────────────────────────────────

const queue: QueueItem[] = [];
const deadLetterQueue: QueueItem[] = [];

let activeWorkers = 0;
let completedCount = 0;

// ─── Queue Stats ──────────────────────────────────────────────────────────────

export function getQueueStats(): QueueStats {
  const pending = queue.filter((i) => i.status === 'PENDING').length;
  const processing = queue.filter((i) => i.status === 'PROCESSING').length;
  const dead = deadLetterQueue.length;

  return {
    pending,
    processing,
    completed: completedCount,
    deadLetter: dead,
    total: pending + processing + completedCount + dead,
  };
}

// ─── Get All Items (for debugging/stats) ─────────────────────────────────────

export function getAllQueueItems(): {
  active: QueueItem[];
  deadLetter: QueueItem[];
  stats: QueueStats;
} {
  return {
    active: [...queue],
    deadLetter: [...deadLetterQueue],
    stats: getQueueStats(),
  };
}

// ─── Update Item Status ───────────────────────────────────────────────────────

function updateItemStatus(queueId: string, status: QueueItemStatus): void {
  const item = queue.find((i) => i.queueId === queueId);
  if (item) {
    item.status = status;
    item.updatedAt = new Date().toISOString();
  }
}

// ─── Remove Item from Active Queue ───────────────────────────────────────────

function removeFromQueue(queueId: string): QueueItem | undefined {
  const idx = queue.findIndex((i) => i.queueId === queueId);
  if (idx !== -1) {
    return queue.splice(idx, 1)[0];
  }
  return undefined;
}

// ─── Process a Single Queue Item ─────────────────────────────────────────────

async function processItem(item: QueueItem): Promise<void> {
  updateItemStatus(item.queueId, 'PROCESSING');
  activeWorkers++;

  console.log(
    `[QUEUE] ▶️  Processing → queueId="${item.queueId}" ` +
      `communicationId="${item.payload.communicationId}" ` +
      `channel="${item.payload.channel}" ` +
      `attempt=${item.attempt}`
  );

  try {
    await simulateDelivery({
      communicationId: item.payload.communicationId,
      customerId: item.payload.customerId,
      customerEmail: item.payload.customerEmail,
      customerName: item.payload.customerName,
      channel: item.payload.channel,
      message: item.payload.message,
      subject: item.payload.subject,
      queueId: item.queueId,
    });

    // Remove from active queue on success and increment completed counter
    removeFromQueue(item.queueId);
    completedCount++;

    console.log(
      `[QUEUE] ✅ Completed → queueId="${item.queueId}" ` +
        `communicationId="${item.payload.communicationId}"`
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    if (item.attempt >= MAX_RETRY_ATTEMPTS) {
      // Move to dead letter queue
      item.status = 'DEAD_LETTER';
      item.updatedAt = new Date().toISOString();
      const dead = removeFromQueue(item.queueId);
      if (dead) {
        deadLetterQueue.push(dead);
      }
      console.error(
        `[QUEUE] 💀 Dead Letter → queueId="${item.queueId}" ` +
          `after ${MAX_RETRY_ATTEMPTS} attempts. Error: ${errorMsg}`
      );
    } else {
      // Exponential backoff retry
      item.attempt++;
      item.status = 'PENDING';
      item.updatedAt = new Date().toISOString();

      const backoffMs = Math.pow(2, item.attempt - 1) * 1000; // 1s, 2s, 4s
      console.warn(
        `[QUEUE] ⚠️  Retry scheduled → queueId="${item.queueId}" ` +
          `attempt=${item.attempt}/${MAX_RETRY_ATTEMPTS} ` +
          `backoff=${backoffMs}ms. Error: ${errorMsg}`
      );

      setTimeout(() => {
        drainQueue();
      }, backoffMs);
    }
  } finally {
    activeWorkers--;
    // Drain queue again to pick up any pending items
    setImmediate(drainQueue);
  }
}

// ─── Drain Queue ─────────────────────────────────────────────────────────────
// Picks up PENDING items and processes them up to MAX_CONCURRENCY

function drainQueue(): void {
  const pendingItems = queue.filter((i) => i.status === 'PENDING');

  const slotsAvailable = MAX_CONCURRENCY - activeWorkers;
  const toProcess = pendingItems.slice(0, slotsAvailable);

  for (const item of toProcess) {
    // Fire and forget — errors are caught inside processItem
    processItem(item).catch((err) => {
      console.error(
        `[QUEUE] Unhandled error in processItem for queueId="${item.queueId}":`,
        err
      );
    });
  }
}

// ─── Enqueue ─────────────────────────────────────────────────────────────────

export function enqueue(payload: SendMessagePayload): QueueItem {
  const now = new Date().toISOString();

  const item: QueueItem = {
    queueId: uuidv4(),
    payload,
    status: 'PENDING',
    attempt: 1,
    createdAt: now,
    updatedAt: now,
  };

  queue.push(item);

  console.log(
    `[QUEUE] ➕ Enqueued → queueId="${item.queueId}" ` +
      `communicationId="${payload.communicationId}" ` +
      `channel="${payload.channel}" ` +
      `queueLength=${queue.length}`
  );

  // Trigger drain asynchronously so we return the queueId immediately
  setImmediate(drainQueue);

  return item;
}
