// ============================================================
// src/services/simulator.service.ts
// Simulates realistic message delivery lifecycle events
// and fires callbacks to the backend at randomized intervals.
// ============================================================

import axios from 'axios';
import { Channel, CallbackPayload, DeliveryEvent } from '../types';

// ─── Configuration ────────────────────────────────────────────────────────────

const CALLBACK_URL =
  process.env.BACKEND_CALLBACK_URL ||
  'http://localhost:4000/api/channel/receipt';

// ─── Probability Gates ────────────────────────────────────────────────────────

const PROBABILITIES = {
  DELIVERED: 0.85, // 85% chance of delivery
  OPENED: 0.60,    // 60% of delivered messages get opened
  READ: 0.75,      // 75% of opened messages get read
  CLICKED: 0.40,   // 40% of read messages get clicked
  CONVERTED: 0.25, // 25% of clicked messages lead to conversion
} as const;

// ─── Timing Ranges (milliseconds) ────────────────────────────────────────────

const TIMING = {
  SENT: { min: 0, max: 0 },
  DELIVERED_FAILED: { min: 2000, max: 5000 },
  OPENED: { min: 5000, max: 15000 },
  READ: { min: 15000, max: 30000 },
  CLICKED: { min: 30000, max: 60000 },
  CONVERTED: { min: 60000, max: 120000 },
} as const;

// ─── Helper: Random number in range ──────────────────────────────────────────

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Helper: Random boolean by probability ────────────────────────────────────

function rollDice(probability: number): boolean {
  return Math.random() < probability;
}

// ─── Helper: Sleep ────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Fire Callback with Retry ─────────────────────────────────────────────────

async function fireCallback(
  payload: CallbackPayload,
  retries: number = 3,
  delayMs: number = 1000
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await axios.post(CALLBACK_URL, payload, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' },
      });
      console.log(
        `[SIMULATOR] ✅ Callback fired → event="${payload.event}" ` +
          `communicationId="${payload.communicationId}" attempt=${attempt}`
      );
      return;
    } catch (err: unknown) {
      const isLast = attempt === retries;
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (isLast) {
        console.error(
          `[SIMULATOR] ❌ Callback DEAD LETTER → event="${payload.event}" ` +
            `communicationId="${payload.communicationId}" error="${errorMsg}"`
        );
      } else {
        const backoff = delayMs * Math.pow(2, attempt - 1);
        console.warn(
          `[SIMULATOR] ⚠️  Callback failed (attempt ${attempt}/${retries}), ` +
            `retrying in ${backoff}ms → error="${errorMsg}"`
        );
        await sleep(backoff);
      }
    }
  }
}

// ─── Build Callback Payload ───────────────────────────────────────────────────

function buildPayload(
  communicationId: string,
  event: DeliveryEvent,
  channel: Channel,
  attempt: number,
  extra?: Record<string, string>
): CallbackPayload {
  return {
    communicationId,
    event: event.toLowerCase(),
    timestamp: new Date().toISOString(),
    metadata: {
      channel,
      attempt,
      ...extra,
    },
  };
}

// ─── Main Simulator Entry Point ───────────────────────────────────────────────

export async function simulateDelivery(params: {
  communicationId: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  channel: Channel;
  message: string;
  subject?: string;
  queueId: string;
}): Promise<void> {
  const {
    communicationId,
    customerId,
    customerEmail,
    customerName,
    channel,
    subject,
    queueId,
  } = params;

  const extraMeta: Record<string, string> = {
    customerId,
    customerEmail,
    customerName,
    queueId,
    ...(subject ? { subject } : {}),
  };

  console.log(
    `[SIMULATOR] 🚀 Starting delivery simulation → ` +
      `communicationId="${communicationId}" channel="${channel}"`
  );

  // ── 1. SENT (always, immediate) ──────────────────────────────────────────

  await fireCallback(
    buildPayload(communicationId, 'SENT', channel, 1, extraMeta),
    3,
    1000
  );

  console.log(`[SIMULATOR] 📤 SENT → communicationId="${communicationId}"`);

  // ── 2. DELIVERED or FAILED (2–5 seconds) ────────────────────────────────

  const deliveryDelay = randomBetween(
    TIMING.DELIVERED_FAILED.min,
    TIMING.DELIVERED_FAILED.max
  );

  await sleep(deliveryDelay);

  const isDelivered = rollDice(PROBABILITIES.DELIVERED);

  if (!isDelivered) {
    // Path: FAILED
    await fireCallback(
      buildPayload(communicationId, 'FAILED', channel, 1, {
        ...extraMeta,
        reason: 'Simulated delivery failure',
      }),
      3,
      1000
    );
    console.log(
      `[SIMULATOR] ❌ FAILED → communicationId="${communicationId}" ` +
        `(after ${deliveryDelay}ms)`
    );
    return; // end simulation
  }

  // Path: DELIVERED
  await fireCallback(
    buildPayload(communicationId, 'DELIVERED', channel, 1, extraMeta),
    3,
    1000
  );
  console.log(
    `[SIMULATOR] 📬 DELIVERED → communicationId="${communicationId}" ` +
      `(after ${deliveryDelay}ms)`
  );

  // ── 3. OPENED (5–15 seconds after delivery) ──────────────────────────────

  const isOpened = rollDice(PROBABILITIES.OPENED);
  if (!isOpened) {
    console.log(
      `[SIMULATOR] 👀 Not opened → communicationId="${communicationId}"`
    );
    return;
  }

  const openDelay = randomBetween(TIMING.OPENED.min, TIMING.OPENED.max);
  await sleep(openDelay);

  await fireCallback(
    buildPayload(communicationId, 'OPENED', channel, 1, extraMeta),
    3,
    1000
  );
  console.log(
    `[SIMULATOR] 📖 OPENED → communicationId="${communicationId}" ` +
      `(after ${openDelay}ms)`
  );

  // ── 4. READ (15–30 seconds after open) ──────────────────────────────────

  const isRead = rollDice(PROBABILITIES.READ);
  if (!isRead) {
    console.log(
      `[SIMULATOR] 📄 Not read → communicationId="${communicationId}"`
    );
    return;
  }

  const readDelay = randomBetween(TIMING.READ.min, TIMING.READ.max);
  await sleep(readDelay);

  await fireCallback(
    buildPayload(communicationId, 'READ', channel, 1, extraMeta),
    3,
    1000
  );
  console.log(
    `[SIMULATOR] 🔍 READ → communicationId="${communicationId}" ` +
      `(after ${readDelay}ms)`
  );

  // ── 5. CLICKED (30–60 seconds after read) ───────────────────────────────

  const isClicked = rollDice(PROBABILITIES.CLICKED);
  if (!isClicked) {
    console.log(
      `[SIMULATOR] 🖱️  Not clicked → communicationId="${communicationId}"`
    );
    return;
  }

  const clickDelay = randomBetween(TIMING.CLICKED.min, TIMING.CLICKED.max);
  await sleep(clickDelay);

  await fireCallback(
    buildPayload(communicationId, 'CLICKED', channel, 1, extraMeta),
    3,
    1000
  );
  console.log(
    `[SIMULATOR] 🖱️  CLICKED → communicationId="${communicationId}" ` +
      `(after ${clickDelay}ms)`
  );

  // ── 6. CONVERTED (60–120 seconds after click) ───────────────────────────

  const isConverted = rollDice(PROBABILITIES.CONVERTED);
  if (!isConverted) {
    console.log(
      `[SIMULATOR] 💰 Not converted → communicationId="${communicationId}"`
    );
    return;
  }

  const convertDelay = randomBetween(TIMING.CONVERTED.min, TIMING.CONVERTED.max);
  await sleep(convertDelay);

  await fireCallback(
    buildPayload(communicationId, 'CONVERTED', channel, 1, extraMeta),
    3,
    1000
  );
  console.log(
    `[SIMULATOR] 💰 CONVERTED → communicationId="${communicationId}" ` +
      `(after ${convertDelay}ms)`
  );

  console.log(
    `[SIMULATOR] 🏁 Simulation complete → communicationId="${communicationId}"`
  );
}
