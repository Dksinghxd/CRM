import axios, { AxiosError } from 'axios';

const CHANNEL_SERVICE_URL = process.env.CHANNEL_SERVICE_URL || 'http://localhost:5000';
const BACKEND_CALLBACK_URL =
  process.env.BACKEND_CALLBACK_URL || 'http://localhost:4000/api/channel/receipt';

export interface SendMessagePayload {
  communicationId: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH';
  message: string;
  subject?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface SendMessageResult {
  success: boolean;
  externalId?: string;
  error?: string;
  status?: string;
}

/**
 * Send a message via the channel microservice
 */
export const sendMessage = async (
  payload: SendMessagePayload
): Promise<SendMessageResult> => {
  try {
    const response = await axios.post(
      `${CHANNEL_SERVICE_URL}/send`,
      {
        ...payload,
        callbackUrl: BACKEND_CALLBACK_URL,
      },
      {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      externalId: response.data?.externalId || response.data?.id,
      status: response.data?.status || 'SENT',
    };
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;

    if (axiosError.response) {
      // Channel service returned an error response
      console.error(
        `Channel service error for communication ${payload.communicationId}:`,
        axiosError.response.status,
        axiosError.response.data
      );
      return {
        success: false,
        error: axiosError.response.data?.message || `Channel service error: ${axiosError.response.status}`,
      };
    } else if (axiosError.request) {
      // No response received (service down)
      console.error(
        `Channel service unreachable for communication ${payload.communicationId}:`,
        axiosError.message
      );
      return {
        success: false,
        error: 'Channel service is unreachable. Message will be retried.',
      };
    } else {
      console.error(`Request setup error for communication ${payload.communicationId}:`, error);
      return {
        success: false,
        error: 'Failed to send message due to internal error.',
      };
    }
  }
};

/**
 * Batch send messages with concurrency control
 */
export const batchSendMessages = async (
  payloads: SendMessagePayload[],
  concurrency = 10
): Promise<{ results: SendMessageResult[]; successCount: number; failCount: number }> => {
  const results: SendMessageResult[] = [];
  let successCount = 0;
  let failCount = 0;

  // Process in batches for concurrency control
  for (let i = 0; i < payloads.length; i += concurrency) {
    const batch = payloads.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map((p) => sendMessage(p)));

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
        if (result.value.success) {
          successCount++;
        } else {
          failCount++;
        }
      } else {
        results.push({ success: false, error: result.reason?.message || 'Unknown error' });
        failCount++;
      }
    }

    // Small delay between batches to avoid overwhelming the channel service
    if (i + concurrency < payloads.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return { results, successCount, failCount };
};

/**
 * Check health of channel service
 */
export const checkChannelServiceHealth = async (): Promise<{
  online: boolean;
  latencyMs?: number;
  error?: string;
}> => {
  const start = Date.now();
  try {
    await axios.get(`${CHANNEL_SERVICE_URL}/health`, { timeout: 5000 });
    return { online: true, latencyMs: Date.now() - start };
  } catch {
    return {
      online: false,
      latencyMs: Date.now() - start,
      error: 'Channel service is not responding',
    };
  }
};
