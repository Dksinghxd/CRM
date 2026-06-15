// @ts-nocheck
import prisma from '../lib/prisma';
import { getSegmentCustomerIds, SegmentRule } from './segment.service';
import { batchSendMessages, SendMessagePayload } from './channel.service';
import { CampaignStatus, CommunicationStatus } from '@prisma/client';

export interface LaunchCampaignResult {
  campaignId: string;
  totalCustomers: number;
  successCount: number;
  failCount: number;
  skipped: number;
  status: CampaignStatus;
}

/**
 * Main campaign launch flow:
 * 1. Find customers matching segment rules
 * 2. Create Communication records
 * 3. Send via channel service
 * 4. Update statuses
 */
export const launchCampaign = async (
  campaignId: string
): Promise<LaunchCampaignResult> => {
  // Fetch campaign with segment
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      segment: true,
    },
  });

  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  if (campaign.status === 'RUNNING') {
    throw new Error('Campaign is already running');
  }

  if (campaign.status === 'COMPLETED') {
    throw new Error('Campaign has already been completed');
  }

  // Update campaign to RUNNING
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: 'RUNNING' as CampaignStatus,
      launchedAt: new Date(),
    },
  });

  try {
    // Step 1: Get target customers
    let targetCustomers: Array<{ id: string; name: string; email: string }> = [];

    if (campaign.segment && campaign.segment.rules) {
      const rules = campaign.segment.rules as SegmentRule[];
      targetCustomers = await getSegmentCustomerIds(rules, campaign.segment.operator);
    } else {
      // No segment = send to all customers
      targetCustomers = await prisma.customer.findMany({
        select: { id: true, name: true, email: true },
      });
    }

    if (targetCustomers.length === 0) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'COMPLETED' as CampaignStatus,
          completedAt: new Date(),
          totalSent: 0,
        },
      });

      return {
        campaignId,
        totalCustomers: 0,
        successCount: 0,
        failCount: 0,
        skipped: 0,
        status: 'COMPLETED' as CampaignStatus,
      };
    }

    // Step 2: Get existing communications to avoid duplicates
    const existingComms = await prisma.communication.findMany({
      where: { campaignId },
      select: { customerId: true },
    });

    const existingCustomerIds = new Set(existingComms.map((c) => c.customerId));
    const newCustomers = targetCustomers.filter((c) => !existingCustomerIds.has(c.id));
    const skipped = targetCustomers.length - newCustomers.length;

    if (newCustomers.length === 0) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'COMPLETED' as CampaignStatus,
          completedAt: new Date(),
        },
      });

      return {
        campaignId,
        totalCustomers: targetCustomers.length,
        successCount: 0,
        failCount: 0,
        skipped,
        status: 'COMPLETED' as CampaignStatus,
      };
    }

    // Step 3: Create communication records in batch
    const communicationData = newCustomers.map((customer) => ({
      campaignId,
      customerId: customer.id,
      channel: campaign.channel,
      status: 'PENDING' as CommunicationStatus,
      message: campaign.message,
    }));

    await prisma.communication.createMany({ data: communicationData });

    // Fetch created communications with customer info
    const communications = await prisma.communication.findMany({
      where: {
        campaignId,
        status: 'PENDING',
      },
      include: {
        customer: { select: { id: true, name: true, email: true } },
      },
    });

    // Step 4: Build payloads and send via channel service
    const payloads: SendMessagePayload[] = communications.map((comm) => ({
      communicationId: comm.id,
      customerId: comm.customerId,
      customerEmail: comm.customer.email,
      customerName: comm.customer.name,
      channel: comm.channel,
      message: comm.message,
      subject: campaign.subject || undefined,
      metadata: {
        campaignId: campaign.id,
        campaignName: campaign.name,
        headline: campaign.headline,
        cta: campaign.cta,
      },
    }));

    const { results, successCount, failCount } = await batchSendMessages(payloads, 10);

    // Step 5: Update communication statuses based on results
    const updatePromises: Promise<unknown>[] = [];

    for (let i = 0; i < communications.length; i++) {
      const comm = communications[i];
      const result = results[i];

      if (result?.success) {
        updatePromises.push(
          prisma.communication.update({
            where: { id: comm.id },
            data: {
              status: 'SENT' as CommunicationStatus,
              externalId: result.externalId,
            },
          })
        );

        // Create SENT event
        updatePromises.push(
          prisma.communicationEvent.create({
            data: {
              communicationId: comm.id,
              event: 'sent',
              timestamp: new Date(),
              metadata: { externalId: result.externalId },
            },
          })
        );
      } else {
        updatePromises.push(
          prisma.communication.update({
            where: { id: comm.id },
            data: {
              status: 'FAILED' as CommunicationStatus,
            },
          })
        );

        // Create FAILED event
        updatePromises.push(
          prisma.communicationEvent.create({
            data: {
              communicationId: comm.id,
              event: 'failed',
              timestamp: new Date(),
              metadata: { error: result?.error || 'Unknown error' },
            },
          })
        );
      }
    }

    await Promise.allSettled(updatePromises);

    // Step 6: Update campaign aggregated stats
    const totalSent = existingComms.length + successCount;
    const totalFailed = existingComms.length > 0
      ? (await prisma.communication.count({ where: { campaignId, status: 'FAILED' } }))
      : failCount;

    const finalStatus: CampaignStatus = failCount === newCustomers.length && newCustomers.length > 0
      ? 'FAILED'
      : 'COMPLETED';

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        totalSent,
        totalFailed,
      },
    });

    return {
      campaignId,
      totalCustomers: targetCustomers.length,
      successCount,
      failCount,
      skipped,
      status: finalStatus,
    };
  } catch (error) {
    // Mark campaign as FAILED
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'FAILED' as CampaignStatus },
    }).catch(() => {}); // Silent catch to avoid masking original error

    throw error;
  }
};

/**
 * Update campaign stats after a communication event receipt
 */
export const updateCampaignStats = async (campaignId: string): Promise<void> => {
  const stats = await prisma.communication.groupBy({
    by: ['status'],
    where: { campaignId },
    _count: { id: true },
  });

  const countMap: Record<string, number> = {};
  for (const s of stats) {
    countMap[s.status] = s._count.id;
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      totalSent:
        (countMap['SENT'] || 0) +
        (countMap['DELIVERED'] || 0) +
        (countMap['OPENED'] || 0) +
        (countMap['READ'] || 0) +
        (countMap['CLICKED'] || 0) +
        (countMap['CONVERTED'] || 0),
      totalDelivered: countMap['DELIVERED'] || 0,
      totalFailed: countMap['FAILED'] || 0,
      totalOpened: (countMap['OPENED'] || 0) + (countMap['READ'] || 0),
      totalClicked: countMap['CLICKED'] || 0,
      totalConverted: countMap['CONVERTED'] || 0,
    },
  });
};

