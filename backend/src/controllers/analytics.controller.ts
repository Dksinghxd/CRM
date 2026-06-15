import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../middleware/error.middleware';

// GET /api/analytics/dashboard
export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    totalCustomers,
    totalRevenue,
    totalCampaigns,
    totalOrders,
    avgOrderValue,
    newCustomersThisMonth,
    newCustomersLastMonth,
    revenueThisMonth,
    revenueLastMonth,
    topCities,
    revenueByMonth,
    campaignPerformance,
    channelBreakdown,
    categoryBreakdown,
  ] = await Promise.all([
    // Totals
    prisma.customer.count(),
    prisma.order.aggregate({ _sum: { amount: true }, where: { status: 'COMPLETED' } }),
    prisma.campaign.count(),
    prisma.order.count({ where: { status: 'COMPLETED' } }),

    // Avg order value
    prisma.order.aggregate({ _avg: { amount: true }, where: { status: 'COMPLETED' } }),

    // Growth metrics
    prisma.customer.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.customer.count({ where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
    prisma.order.aggregate({
      _sum: { amount: true },
      where: { status: 'COMPLETED', purchaseDate: { gte: startOfMonth } },
    }),
    prisma.order.aggregate({
      _sum: { amount: true },
      where: { status: 'COMPLETED', purchaseDate: { gte: startOfLastMonth, lte: endOfLastMonth } },
    }),

    // Top cities by customer count
    prisma.customer.groupBy({
      by: ['city'],
      _count: { city: true },
      _sum: { totalSpent: true },
      orderBy: { _count: { city: 'desc' } },
      take: 8,
      where: { city: { not: null } },
    }),

    // Revenue by month (last 12 months) — using raw query for date grouping
    prisma.$queryRaw<Array<{ month: string; revenue: number; orders: bigint }>>`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', "purchaseDate"), 'YYYY-MM') as month,
        SUM(amount)::float as revenue,
        COUNT(*)::bigint as orders
      FROM orders 
      WHERE status = 'COMPLETED' 
        AND "purchaseDate" >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', "purchaseDate")
      ORDER BY DATE_TRUNC('month', "purchaseDate") ASC
    `,

    // Campaign performance summary
    prisma.campaign.findMany({
      where: { status: { in: ['COMPLETED', 'RUNNING'] } },
      select: {
        id: true,
        name: true,
        channel: true,
        status: true,
        launchedAt: true,
        totalSent: true,
        totalDelivered: true,
        totalOpened: true,
        totalClicked: true,
        totalConverted: true,
        totalFailed: true,
      },
      orderBy: { launchedAt: 'desc' },
      take: 10,
    }),

    // Channel breakdown
    prisma.campaign.groupBy({
      by: ['channel'],
      _count: { id: true },
      _sum: { totalSent: true, totalOpened: true, totalClicked: true, totalConverted: true },
    }),

    // Top product categories
    prisma.order.groupBy({
      by: ['category'],
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 8,
      where: { status: 'COMPLETED' },
    }),
  ]);

  // Compute growth percentages
  const customerGrowth =
    newCustomersLastMonth > 0
      ? +(((newCustomersThisMonth - newCustomersLastMonth) / newCustomersLastMonth) * 100).toFixed(1)
      : 0;

  const revThisMonth = revenueThisMonth._sum.amount || 0;
  const revLastMonth = revenueLastMonth._sum.amount || 0;
  const revenueGrowth =
    revLastMonth > 0
      ? +(((revThisMonth - revLastMonth) / revLastMonth) * 100).toFixed(1)
      : 0;

  // Campaign performance with metrics
  const enrichedCampaigns = campaignPerformance.map((c) => ({
    ...c,
    openRate: c.totalSent > 0 ? +((c.totalOpened / c.totalSent) * 100).toFixed(1) : 0,
    clickRate: c.totalOpened > 0 ? +((c.totalClicked / c.totalOpened) * 100).toFixed(1) : 0,
    conversionRate: c.totalClicked > 0 ? +((c.totalConverted / c.totalClicked) * 100).toFixed(1) : 0,
    deliveryRate: c.totalSent > 0 ? +((c.totalDelivered / c.totalSent) * 100).toFixed(1) : 0,
  }));

  res.status(200).json({
    success: true,
    data: {
      overview: {
        totalCustomers,
        totalRevenue: totalRevenue._sum.amount || 0,
        totalCampaigns,
        totalOrders,
        avgOrderValue: avgOrderValue._avg.amount || 0,
        newCustomersThisMonth,
        revenueThisMonth: revThisMonth,
        customerGrowth,
        revenueGrowth,
      },
      topCities: topCities.map((c) => ({
        city: c.city,
        customers: c._count.city,
        revenue: c._sum.totalSpent || 0,
      })),
      revenueByMonth: revenueByMonth.map((r) => ({
        month: r.month,
        revenue: r.revenue,
        orders: Number(r.orders),
      })),
      campaignPerformance: enrichedCampaigns,
      channelBreakdown: channelBreakdown.map((c) => ({
        channel: c.channel,
        campaigns: c._count.id,
        totalSent: c._sum.totalSent || 0,
        totalOpened: c._sum.totalOpened || 0,
        totalClicked: c._sum.totalClicked || 0,
        totalConverted: c._sum.totalConverted || 0,
      })),
      categoryBreakdown: categoryBreakdown.map((c) => ({
        category: c.category,
        revenue: c._sum.amount || 0,
        orders: c._count.id,
      })),
    },
  });
});

// GET /api/analytics/campaigns
export const getCampaignAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, channel, status } = req.query as Record<string, string>;

  const where: Record<string, unknown> = {};
  if (channel) where.channel = channel;
  if (status) where.status = status;
  if (startDate || endDate) {
    where.createdAt = {};
    const dateFilter = where.createdAt as Record<string, Date>;
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
  }

  const campaigns = await prisma.campaign.findMany({
    where,
    include: {
      segment: { select: { id: true, name: true } },
      _count: { select: { communications: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const enriched = campaigns.map((c) => ({
    ...c,
    metrics: {
      openRate: c.totalSent > 0 ? +((c.totalOpened / c.totalSent) * 100).toFixed(1) : 0,
      clickRate: c.totalOpened > 0 ? +((c.totalClicked / c.totalOpened) * 100).toFixed(1) : 0,
      conversionRate: c.totalClicked > 0 ? +((c.totalConverted / c.totalClicked) * 100).toFixed(1) : 0,
      deliveryRate: c.totalSent > 0 ? +((c.totalDelivered / c.totalSent) * 100).toFixed(1) : 0,
      failRate: c.totalSent > 0 ? +((c.totalFailed / c.totalSent) * 100).toFixed(1) : 0,
    },
  }));

  // Aggregate stats
  const aggregateStats = {
    totalCampaigns: campaigns.length,
    totalSent: campaigns.reduce((sum, c) => sum + c.totalSent, 0),
    totalDelivered: campaigns.reduce((sum, c) => sum + c.totalDelivered, 0),
    totalOpened: campaigns.reduce((sum, c) => sum + c.totalOpened, 0),
    totalClicked: campaigns.reduce((sum, c) => sum + c.totalClicked, 0),
    totalConverted: campaigns.reduce((sum, c) => sum + c.totalConverted, 0),
    totalFailed: campaigns.reduce((sum, c) => sum + c.totalFailed, 0),
  };

  const overallOpenRate =
    aggregateStats.totalSent > 0
      ? +((aggregateStats.totalOpened / aggregateStats.totalSent) * 100).toFixed(1)
      : 0;
  const overallClickRate =
    aggregateStats.totalOpened > 0
      ? +((aggregateStats.totalClicked / aggregateStats.totalOpened) * 100).toFixed(1)
      : 0;
  const overallConversionRate =
    aggregateStats.totalClicked > 0
      ? +((aggregateStats.totalConverted / aggregateStats.totalClicked) * 100).toFixed(1)
      : 0;

  res.status(200).json({
    success: true,
    data: {
      campaigns: enriched,
      aggregate: {
        ...aggregateStats,
        overallOpenRate,
        overallClickRate,
        overallConversionRate,
      },
    },
  });
});

// GET /api/analytics/revenue
export const getRevenueAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const { period = '12months' } = req.query as Record<string, string>;

  let interval = '12 months';
  let groupFormat = 'YYYY-MM';
  let truncUnit = 'month';

  if (period === '30days') {
    interval = '30 days';
    groupFormat = 'YYYY-MM-DD';
    truncUnit = 'day';
  } else if (period === '7days') {
    interval = '7 days';
    groupFormat = 'YYYY-MM-DD';
    truncUnit = 'day';
  } else if (period === '3months') {
    interval = '3 months';
    groupFormat = 'YYYY-MM';
    truncUnit = 'month';
  }

  const revenueData = await prisma.$queryRaw<
    Array<{ period: string; revenue: number; orders: bigint; customers: bigint }>
  >`
    SELECT 
      TO_CHAR(DATE_TRUNC(${truncUnit}, "purchaseDate"), ${groupFormat}) as period,
      SUM(amount)::float as revenue,
      COUNT(*)::bigint as orders,
      COUNT(DISTINCT "customerId")::bigint as customers
    FROM orders 
    WHERE status = 'COMPLETED' 
      AND "purchaseDate" >= NOW() - INTERVAL ${interval}
    GROUP BY DATE_TRUNC(${truncUnit}, "purchaseDate")
    ORDER BY DATE_TRUNC(${truncUnit}, "purchaseDate") ASC
  `;

  const total = await prisma.order.aggregate({
    where: { status: 'COMPLETED' },
    _sum: { amount: true },
    _avg: { amount: true },
    _count: { id: true },
  });

  res.status(200).json({
    success: true,
    data: {
      revenueByPeriod: revenueData.map((r) => ({
        period: r.period,
        revenue: r.revenue,
        orders: Number(r.orders),
        customers: Number(r.customers),
      })),
      totals: {
        totalRevenue: total._sum.amount || 0,
        totalOrders: total._count.id,
        avgOrderValue: total._avg.amount || 0,
      },
    },
  });
});

// GET /api/analytics/customers
export const getCustomerAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const [
    totalCustomers,
    byGender,
    byCity,
    spendingDistribution,
    topSpenders,
    recentlyActive,
    atRisk,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.groupBy({
      by: ['gender'],
      _count: { id: true },
      _avg: { totalSpent: true },
    }),
    prisma.customer.groupBy({
      by: ['city'],
      _count: { id: true },
      _avg: { totalSpent: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
      where: { city: { not: null } },
    }),
    // Spending tiers
    prisma.$queryRaw<Array<{ tier: string; count: bigint }>>`
      SELECT
        CASE
          WHEN "totalSpent" = 0 THEN 'No Purchase'
          WHEN "totalSpent" < 1000 THEN '< ₹1K'
          WHEN "totalSpent" < 5000 THEN '₹1K - ₹5K'
          WHEN "totalSpent" < 10000 THEN '₹5K - ₹10K'
          WHEN "totalSpent" < 50000 THEN '₹10K - ₹50K'
          ELSE '₹50K+'
        END as tier,
        COUNT(*)::bigint as count
      FROM customers
      GROUP BY tier
      ORDER BY MIN("totalSpent") ASC
    `,
    prisma.customer.findMany({
      orderBy: { totalSpent: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        email: true,
        city: true,
        totalSpent: true,
        totalOrders: true,
        lastPurchaseDate: true,
      },
    }),
    prisma.customer.count({
      where: { lastPurchaseDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    }),
    prisma.customer.count({
      where: {
        OR: [
          { lastPurchaseDate: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
          { lastPurchaseDate: null },
        ],
        totalOrders: { gt: 0 },
      },
    }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalCustomers,
      recentlyActive,
      atRisk,
      byGender: byGender.map((g) => ({
        gender: g.gender || 'UNKNOWN',
        count: g._count.id,
        avgSpent: g._avg.totalSpent || 0,
      })),
      byCity: byCity.map((c) => ({
        city: c.city,
        count: c._count.id,
        avgSpent: c._avg.totalSpent || 0,
      })),
      spendingDistribution: spendingDistribution.map((s) => ({
        tier: s.tier,
        count: Number(s.count),
      })),
      topSpenders,
    },
  });
});
