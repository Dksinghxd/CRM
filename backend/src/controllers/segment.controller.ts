// @ts-nocheck
import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../middleware/error.middleware';
import { evaluateSegment, countSegmentCustomers, SegmentRule } from '../services/segment.service';

// GET /api/segments
export const getSegments = asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '20', search } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [segments, total] = await Promise.all([
    prisma.segment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: {
        _count: { select: { campaigns: true } },
      },
    }),
    prisma.segment.count({ where }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      segments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    },
  });
});

// GET /api/segments/:id
export const getSegmentById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const segment = await prisma.segment.findUnique({
    where: { id },
    include: {
      campaigns: {
        select: {
          id: true,
          name: true,
          status: true,
          channel: true,
          launchedAt: true,
          totalSent: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      _count: { select: { campaigns: true } },
    },
  });

  if (!segment) {
    res.status(404).json({ success: false, message: 'Segment not found.' });
    return;
  }

  res.status(200).json({ success: true, data: { segment } });
});

// POST /api/segments
export const createSegment = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, rules, operator, aiGenerated, aiPrompt } = req.body;

  // Count matching customers
  const rules_parsed = Array.isArray(rules) ? rules : [];
  const customerCount = await countSegmentCustomers(rules_parsed as SegmentRule[], operator || 'AND');

  const segment = await prisma.segment.create({
    data: {
      name,
      description,
      rules: rules_parsed,
      operator: operator || 'AND',
      customerCount,
      aiGenerated: aiGenerated || false,
      aiPrompt: aiPrompt || null,
    },
  });

  res.status(201).json({
    success: true,
    message: 'Segment created successfully.',
    data: { segment },
  });
});

// PUT /api/segments/:id
export const updateSegment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, rules, operator } = req.body;

  const existing = await prisma.segment.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Segment not found.' });
    return;
  }

  const updatedRules = rules !== undefined
    ? (Array.isArray(rules) ? rules : [])
    : (existing.rules as SegmentRule[]);

  const updatedOperator = operator || existing.operator;
  const customerCount = await countSegmentCustomers(updatedRules as SegmentRule[], updatedOperator);

  const segment = await prisma.segment.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(rules !== undefined && { rules: updatedRules }),
      ...(operator !== undefined && { operator }),
      customerCount,
    },
  });

  res.status(200).json({
    success: true,
    message: 'Segment updated successfully.',
    data: { segment },
  });
});

// DELETE /api/segments/:id
export const deleteSegment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.segment.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Segment not found.' });
    return;
  }

  await prisma.segment.delete({ where: { id } });

  res.status(200).json({ success: true, message: 'Segment deleted successfully.' });
});

// POST /api/segments/:id/evaluate
export const evaluateSegmentById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { page = '1', limit = '50' } = req.query as Record<string, string>;

  const segment = await prisma.segment.findUnique({ where: { id } });
  if (!segment) {
    res.status(404).json({ success: false, message: 'Segment not found.' });
    return;
  }

  const rules = segment.rules as SegmentRule[];
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));

  const result = await evaluateSegment(rules, segment.operator, pageNum, limitNum);

  // Update customer count in segment
  await prisma.segment.update({
    where: { id },
    data: { customerCount: result.count },
  });

  res.status(200).json({
    success: true,
    data: {
      segmentId: id,
      segmentName: segment.name,
      rules,
      operator: segment.operator,
      ...result,
    },
  });
});

// POST /api/segments/preview
export const previewSegment = asyncHandler(async (req: Request, res: Response) => {
  const { rules, operator = 'AND' } = req.body;

  if (!Array.isArray(rules)) {
    res.status(400).json({ success: false, message: 'rules must be an array.' });
    return;
  }

  const pageNum = 1;
  const limitNum = 10;

  const result = await evaluateSegment(rules as SegmentRule[], operator, pageNum, limitNum);

  res.status(200).json({
    success: true,
    data: {
      count: result.count,
      previewCustomers: result.customers,
      rules,
      operator,
    },
  });
});

