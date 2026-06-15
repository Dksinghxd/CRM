// @ts-nocheck
import { Request, Response } from 'express';
// @ts-nocheck
import prisma from '../lib/prisma';
// @ts-nocheck
import { asyncHandler } from '../middleware/error.middleware';

// POST /api/orders
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const { customerId, amount, category, channel, status, purchaseDate } = req.body;

  // Verify customer exists
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    res.status(404).json({ success: false, message: 'Customer not found.' });
    return;
  }

  const order = await prisma.order.create({
    data: {
      customerId,
      amount: parseFloat(amount),
      category,
      channel: channel || 'ONLINE',
      status: status || 'COMPLETED',
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
    },
    include: {
      customer: { select: { id: true, name: true, email: true } },
    },
  });

  // Update customer aggregates
  const customerStats = await prisma.order.aggregate({
    where: { customerId, status: 'COMPLETED' },
    _sum: { amount: true },
    _count: { id: true },
    _max: { purchaseDate: true },
  });

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      totalOrders: customerStats._count.id,
      totalSpent: customerStats._sum.amount || 0,
      lastPurchaseDate: customerStats._max.purchaseDate,
    },
  });

  res.status(201).json({
    success: true,
    message: 'Order created successfully.',
    data: { order },
  });
});

// GET /api/orders
export const getOrders = asyncHandler(async (req: Request, res: Response) => {
  const {
    customerId,
    category,
    channel,
    status,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    page = '1',
    limit = '20',
    sortBy = 'purchaseDate',
    sortOrder = 'desc',
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const where: Record<string, unknown> = {};

  if (customerId) where.customerId = customerId;
  if (category) where.category = { contains: category, mode: 'insensitive' };
  if (channel) where.channel = channel;
  if (status) where.status = status;

  if (startDate || endDate) {
    where.purchaseDate = {};
    const dateFilter = where.purchaseDate as Record<string, Date>;
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
  }

  if (minAmount || maxAmount) {
    where.amount = {};
    const amountFilter = where.amount as Record<string, number>;
    if (minAmount) amountFilter.gte = parseFloat(minAmount);
    if (maxAmount) amountFilter.lte = parseFloat(maxAmount);
  }

  const validSort = ['purchaseDate', 'amount', 'category', 'status', 'createdAt'];
  const orderField = validSort.includes(sortBy) ? sortBy : 'purchaseDate';

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, email: true, city: true } },
      },
      orderBy: { [orderField]: sortOrder === 'asc' ? 'asc' : 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.order.count({ where }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      orders,
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

// GET /api/orders/:id
export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true, city: true } },
    },
  });

  if (!order) {
    res.status(404).json({ success: false, message: 'Order not found.' });
    return;
  }

  res.status(200).json({ success: true, data: { order } });
});

// GET /api/orders/customer/:customerId
export const getOrdersByCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.params;
  const { page = '1', limit = '20' } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    res.status(404).json({ success: false, message: 'Customer not found.' });
    return;
  }

  const [orders, total, stats] = await Promise.all([
    prisma.order.findMany({
      where: { customerId },
      orderBy: { purchaseDate: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.order.count({ where: { customerId } }),
    prisma.order.aggregate({
      where: { customerId },
      _sum: { amount: true },
      _avg: { amount: true },
      _max: { amount: true, purchaseDate: true },
      _count: { id: true },
    }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      customer: { id: customer.id, name: customer.name, email: customer.email },
      orders,
      stats: {
        totalOrders: stats._count.id,
        totalSpent: stats._sum.amount || 0,
        avgOrderValue: stats._avg.amount || 0,
        maxOrderValue: stats._max.amount || 0,
        lastPurchaseDate: stats._max.purchaseDate,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    },
  });
});

// GET /api/orders/analytics
export const getOrderAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, groupBy = 'month' } = req.query as Record<string, string>;

  const dateFilter: Record<string, Date> = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);

  const [
    overallStats,
    byCategory,
    byChannel,
    byStatus,
    recentOrders,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { purchaseDate: Object.keys(dateFilter).length ? dateFilter : undefined },
      _sum: { amount: true },
      _avg: { amount: true },
      _count: { id: true },
      _max: { amount: true },
    }),
    prisma.order.groupBy({
      by: ['category'],
      where: { purchaseDate: Object.keys(dateFilter).length ? dateFilter : undefined },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 10,
    }),
    prisma.order.groupBy({
      by: ['channel'],
      where: { purchaseDate: Object.keys(dateFilter).length ? dateFilter : undefined },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.order.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.order.findMany({
      orderBy: { purchaseDate: 'desc' },
      take: 5,
      include: {
        customer: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      overall: {
        totalRevenue: overallStats._sum.amount || 0,
        totalOrders: overallStats._count.id,
        avgOrderValue: overallStats._avg.amount || 0,
        maxOrderValue: overallStats._max.amount || 0,
      },
      byCategory: byCategory.map((c) => ({
        category: c.category,
        revenue: c._sum.amount || 0,
        orders: c._count.id,
      })),
      byChannel: byChannel.map((c) => ({
        channel: c.channel,
        revenue: c._sum.amount || 0,
        orders: c._count.id,
      })),
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      recentOrders,
    },
  });
});

// PUT /api/orders/:id
export const updateOrder = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, amount, category } = req.body;

  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Order not found.' });
    return;
  }

  const order = await prisma.order.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(amount !== undefined && { amount: parseFloat(amount) }),
      ...(category !== undefined && { category }),
    },
    include: {
      customer: { select: { id: true, name: true, email: true } },
    },
  });

  // Recalculate customer aggregates
  const customerStats = await prisma.order.aggregate({
    where: { customerId: existing.customerId, status: 'COMPLETED' },
    _sum: { amount: true },
    _count: { id: true },
    _max: { purchaseDate: true },
  });

  await prisma.customer.update({
    where: { id: existing.customerId },
    data: {
      totalOrders: customerStats._count.id,
      totalSpent: customerStats._sum.amount || 0,
      lastPurchaseDate: customerStats._max.purchaseDate,
    },
  });

  res.status(200).json({
    success: true,
    message: 'Order updated successfully.',
    data: { order },
  });
});

// DELETE /api/orders/:id
export const deleteOrder = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Order not found.' });
    return;
  }

  await prisma.order.delete({ where: { id } });

  // Recalculate customer aggregates
  const customerStats = await prisma.order.aggregate({
    where: { customerId: existing.customerId, status: 'COMPLETED' },
    _sum: { amount: true },
    _count: { id: true },
    _max: { purchaseDate: true },
  });

  await prisma.customer.update({
    where: { id: existing.customerId },
    data: {
      totalOrders: customerStats._count.id,
      totalSpent: customerStats._sum.amount || 0,
      lastPurchaseDate: customerStats._max.purchaseDate,
    },
  });

  res.status(200).json({ success: true, message: 'Order deleted successfully.' });
});
