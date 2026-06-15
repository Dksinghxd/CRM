import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../middleware/error.middleware';
import { launchCampaign } from '../services/campaign.service';

// GET /api/campaigns
export const getCampaigns = asyncHandler(async (req: Request, res: Response) => {
  const {
    status,
    channel,
    search,
    page = '1',
    limit = '20',
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (channel) where.channel = channel;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { message: { contains: search, mode: 'insensitive' } },
    ];
  }

  const validSort = ['createdAt', 'launchedAt', 'name', 'totalSent', 'status'];
  const orderField = validSort.includes(sortBy) ? sortBy : 'createdAt';

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy: { [orderField]: sortOrder === 'asc' ? 'asc' : 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: {
        segment: { select: { id: true, name: true, customerCount: true } },
        user: { select: { id: true, name: true } },
        _count: { select: { communications: true } },
      },
    }),
    prisma.campaign.count({ where }),
  ]);

  // Compute derived metrics for each campaign
  const campaignsWithMetrics = campaigns.map((c) => ({
    ...c,
    metrics: {
      openRate: c.totalSent > 0 ? +((c.totalOpened / c.totalSent) * 100).toFixed(1) : 0,
      clickRate: c.totalOpened > 0 ? +((c.totalClicked / c.totalOpened) * 100).toFixed(1) : 0,
      conversionRate: c.totalClicked > 0 ? +((c.totalConverted / c.totalClicked) * 100).toFixed(1) : 0,
      failRate: c.totalSent > 0 ? +((c.totalFailed / c.totalSent) * 100).toFixed(1) : 0,
      deliveryRate: c.totalSent > 0 ? +((c.totalDelivered / c.totalSent) * 100).toFixed(1) : 0,
    },
  }));

  res.status(200).json({
    success: true,
    data: {
      campaigns: campaignsWithMetrics,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1,
      },
    },
  });
});

// GET /api/campaigns/:id
export const getCampaignById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      segment: true,
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { communications: true } },
      communications: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          customer: { select: { id: true, name: true, email: true } },
          events: { orderBy: { timestamp: 'desc' } },
        },
      },
    },
  });

  if (!campaign) {
    res.status(404).json({ success: false, message: 'Campaign not found.' });
    return;
  }

  const metrics = {
    openRate: campaign.totalSent > 0 ? +((campaign.totalOpened / campaign.totalSent) * 100).toFixed(1) : 0,
    clickRate: campaign.totalOpened > 0 ? +((campaign.totalClicked / campaign.totalOpened) * 100).toFixed(1) : 0,
    conversionRate: campaign.totalClicked > 0 ? +((campaign.totalConverted / campaign.totalClicked) * 100).toFixed(1) : 0,
    failRate: campaign.totalSent > 0 ? +((campaign.totalFailed / campaign.totalSent) * 100).toFixed(1) : 0,
    deliveryRate: campaign.totalSent > 0 ? +((campaign.totalDelivered / campaign.totalSent) * 100).toFixed(1) : 0,
  };

  res.status(200).json({
    success: true,
    data: { campaign: { ...campaign, metrics } },
  });
});

// POST /api/campaigns
export const createCampaign = asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    segmentId,
    channel,
    subject,
    message,
    headline,
    cta,
    goal,
    tone,
    scheduledAt,
    status,
  } = req.body;

  // Verify segment exists if provided
  if (segmentId) {
    const segment = await prisma.segment.findUnique({ where: { id: segmentId } });
    if (!segment) {
      res.status(404).json({ success: false, message: 'Segment not found.' });
      return;
    }
  }

  const campaign = await prisma.campaign.create({
    data: {
      name,
      segmentId: segmentId || null,
      channel,
      subject: subject || null,
      message,
      headline: headline || null,
      cta: cta || null,
      goal: goal || null,
      tone: tone || null,
      status: status || 'DRAFT',
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      userId: req.user?.userId || null,
    },
    include: {
      segment: { select: { id: true, name: true, customerCount: true } },
      user: { select: { id: true, name: true } },
    },
  });

  res.status(201).json({
    success: true,
    message: 'Campaign created successfully.',
    data: { campaign },
  });
});

// PUT /api/campaigns/:id
export const updateCampaign = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    name,
    segmentId,
    channel,
    subject,
    message,
    headline,
    cta,
    goal,
    tone,
    status,
    scheduledAt,
  } = req.body;

  const existing = await prisma.campaign.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Campaign not found.' });
    return;
  }

  // Can only edit DRAFT or SCHEDULED campaigns
  if (!['DRAFT', 'SCHEDULED', 'PAUSED'].includes(existing.status)) {
    res.status(400).json({
      success: false,
      message: `Cannot edit a campaign in ${existing.status} status.`,
    });
    return;
  }

  const campaign = await prisma.campaign.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(segmentId !== undefined && { segmentId }),
      ...(channel !== undefined && { channel }),
      ...(subject !== undefined && { subject }),
      ...(message !== undefined && { message }),
      ...(headline !== undefined && { headline }),
      ...(cta !== undefined && { cta }),
      ...(goal !== undefined && { goal }),
      ...(tone !== undefined && { tone }),
      ...(status !== undefined && { status }),
      ...(scheduledAt !== undefined && { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }),
    },
    include: {
      segment: { select: { id: true, name: true, customerCount: true } },
    },
  });

  res.status(200).json({
    success: true,
    message: 'Campaign updated successfully.',
    data: { campaign },
  });
});

// DELETE /api/campaigns/:id
export const deleteCampaign = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.campaign.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Campaign not found.' });
    return;
  }

  if (existing.status === 'RUNNING') {
    res.status(400).json({
      success: false,
      message: 'Cannot delete a running campaign. Pause it first.',
    });
    return;
  }

  await prisma.campaign.delete({ where: { id } });

  res.status(200).json({ success: true, message: 'Campaign deleted successfully.' });
});

// POST /api/campaigns/:id/launch
export const launchCampaignController = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) {
    res.status(404).json({ success: false, message: 'Campaign not found.' });
    return;
  }

  if (!campaign.message) {
    res.status(400).json({
      success: false,
      message: 'Campaign must have a message before launching.',
    });
    return;
  }

  // Launch asynchronously for large campaigns
  // For small campaigns, we wait for the result
  const result = await launchCampaign(id);

  res.status(200).json({
    success: true,
    message: `Campaign launched successfully. Sent to ${result.successCount} customers.`,
    data: result,
  });
});

// GET /api/campaigns/:id/communications
export const getCampaignCommunications = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    status,
    page = '1',
    limit = '20',
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, parseInt(limit, 10));

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) {
    res.status(404).json({ success: false, message: 'Campaign not found.' });
    return;
  }

  const where: Record<string, unknown> = { campaignId: id };
  if (status) where.status = status;

  const [communications, total] = await Promise.all([
    prisma.communication.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, email: true, city: true } },
        events: { orderBy: { timestamp: 'desc' }, take: 5 },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.communication.count({ where }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      communications,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    },
  });
});

// POST /api/campaigns/:id/duplicate
export const duplicateCampaign = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const original = await prisma.campaign.findUnique({ where: { id } });
  if (!original) {
    res.status(404).json({ success: false, message: 'Campaign not found.' });
    return;
  }

  const copy = await prisma.campaign.create({
    data: {
      name: `${original.name} (Copy)`,
      segmentId: original.segmentId,
      channel: original.channel,
      subject: original.subject,
      message: original.message,
      headline: original.headline,
      cta: original.cta,
      goal: original.goal,
      tone: original.tone,
      status: 'DRAFT',
      userId: req.user?.userId || null,
    },
  });

  res.status(201).json({
    success: true,
    message: 'Campaign duplicated successfully.',
    data: { campaign: copy },
  });
});
