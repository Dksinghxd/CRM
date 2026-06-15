import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import {
  buildSegment,
  generateCampaignMessage,
  analyzePerformance,
  copilotChat,
  generateCampaignNames,
  CopilotMessage,
} from '../services/ai.service';
import prisma from '../lib/prisma';

// POST /api/ai/segment-builder
export const aiSegmentBuilder = asyncHandler(async (req: Request, res: Response) => {
  const { prompt, save, name, description } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ success: false, message: 'prompt is required.' });
    return;
  }

  const rules = await buildSegment(prompt);

  // Count matching customers
  let customerCount = 0;
  try {
    const { countSegmentCustomers } = await import('../services/segment.service');
    customerCount = await countSegmentCustomers(rules);
  } catch {
    customerCount = 0;
  }

  let savedSegment = null;

  // Save to DB if requested
  if (save && name) {
    savedSegment = await prisma.segment.create({
      data: {
        name,
        description: description || `AI-generated: "${prompt}"`,
        rules,
        operator: 'AND',
        customerCount,
        aiGenerated: true,
        aiPrompt: prompt,
      },
    });
  }

  res.status(200).json({
    success: true,
    data: {
      rules,
      customerCount,
      aiPrompt: prompt,
      segment: savedSegment,
    },
  });
});

// POST /api/ai/message-generator
export const aiMessageGenerator = asyncHandler(async (req: Request, res: Response) => {
  const { goal, audience, tone, channel } = req.body;

  if (!goal) {
    res.status(400).json({ success: false, message: 'goal is required.' });
    return;
  }

  const result = await generateCampaignMessage(
    goal,
    audience || 'general customers',
    tone || 'friendly'
  );

  res.status(200).json({
    success: true,
    data: {
      ...result,
      channel: channel || 'EMAIL',
      generatedAt: new Date().toISOString(),
    },
  });
});

// POST /api/ai/performance-analyst
export const aiPerformanceAnalyst = asyncHandler(async (req: Request, res: Response) => {
  const { campaignId } = req.body;

  let campaignData: {
    name: string;
    channel: string;
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    totalConverted: number;
    totalFailed: number;
    segment?: string;
    goal?: string;
  };

  if (campaignId) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { segment: { select: { name: true } } },
    });

    if (!campaign) {
      res.status(404).json({ success: false, message: 'Campaign not found.' });
      return;
    }

    campaignData = {
      name: campaign.name,
      channel: campaign.channel,
      totalSent: campaign.totalSent,
      totalDelivered: campaign.totalDelivered,
      totalOpened: campaign.totalOpened,
      totalClicked: campaign.totalClicked,
      totalConverted: campaign.totalConverted,
      totalFailed: campaign.totalFailed,
      segment: campaign.segment?.name,
      goal: campaign.goal || undefined,
    };
  } else {
    // Accept raw data from request body
    const { name, channel, totalSent, totalDelivered, totalOpened, totalClicked, totalConverted, totalFailed, segment, goal } = req.body;

    if (!name || !channel) {
      res.status(400).json({ success: false, message: 'Either campaignId or campaign data (name, channel, stats) is required.' });
      return;
    }

    campaignData = {
      name,
      channel,
      totalSent: parseInt(totalSent, 10) || 0,
      totalDelivered: parseInt(totalDelivered, 10) || 0,
      totalOpened: parseInt(totalOpened, 10) || 0,
      totalClicked: parseInt(totalClicked, 10) || 0,
      totalConverted: parseInt(totalConverted, 10) || 0,
      totalFailed: parseInt(totalFailed, 10) || 0,
      segment,
      goal,
    };
  }

  const analysis = await analyzePerformance(campaignData);

  res.status(200).json({
    success: true,
    data: {
      campaign: {
        name: campaignData.name,
        channel: campaignData.channel,
        stats: {
          totalSent: campaignData.totalSent,
          totalDelivered: campaignData.totalDelivered,
          totalOpened: campaignData.totalOpened,
          totalClicked: campaignData.totalClicked,
          totalConverted: campaignData.totalConverted,
          totalFailed: campaignData.totalFailed,
          openRate: campaignData.totalSent > 0 ? +((campaignData.totalOpened / campaignData.totalSent) * 100).toFixed(1) : 0,
          clickRate: campaignData.totalOpened > 0 ? +((campaignData.totalClicked / campaignData.totalOpened) * 100).toFixed(1) : 0,
          conversionRate: campaignData.totalClicked > 0 ? +((campaignData.totalConverted / campaignData.totalClicked) * 100).toFixed(1) : 0,
        },
      },
      analysis,
      analyzedAt: new Date().toISOString(),
    },
  });
});

// POST /api/ai/copilot
export const aiCopilot = asyncHandler(async (req: Request, res: Response) => {
  const { messages, includeContext = true } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ success: false, message: 'messages array is required.' });
    return;
  }

  // Validate message format
  const validMessages: CopilotMessage[] = messages
    .filter((m) => m.role && m.content && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content }));

  if (validMessages.length === 0) {
    res.status(400).json({
      success: false,
      message: 'Invalid messages format. Each message must have role and content.',
    });
    return;
  }

  // Optionally gather context from the DB
  let context: Parameters<typeof copilotChat>[1] | undefined;

  if (includeContext) {
    try {
      const [totalCustomers, totalCampaigns, revenueAgg, recentCampaigns] = await Promise.all([
        prisma.customer.count(),
        prisma.campaign.count(),
        prisma.order.aggregate({ _sum: { amount: true }, where: { status: 'COMPLETED' } }),
        prisma.campaign.findMany({
          select: { name: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);

      context = {
        totalCustomers,
        totalCampaigns,
        totalRevenue: revenueAgg._sum.amount || 0,
        recentCampaigns: recentCampaigns.map((c) => c.name),
      };
    } catch {
      // Context is optional, proceed without it
    }
  }

  const response = await copilotChat(validMessages, context);

  res.status(200).json({
    success: true,
    data: {
      message: response,
      role: 'assistant',
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /api/ai/campaign-names
export const aiCampaignNames = asyncHandler(async (req: Request, res: Response) => {
  const { goal, channel } = req.body;

  if (!goal) {
    res.status(400).json({ success: false, message: 'goal is required.' });
    return;
  }

  const names = await generateCampaignNames(goal, channel || 'EMAIL');

  res.status(200).json({
    success: true,
    data: { names },
  });
});
