import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { asyncHandler } from '../middleware/error.middleware';

// GET /api/customers
export const getCustomers = asyncHandler(async (req: Request, res: Response) => {
  const {
    search,
    city,
    gender,
    minAge,
    maxAge,
    minSpent,
    maxSpent,
    minOrders,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = '1',
    limit = '20',
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const where: Prisma.CustomerWhereInput = {};

  // Full-text search on name, email, phone
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (city) {
    where.city = { equals: city, mode: 'insensitive' };
  }

  if (gender) {
    where.gender = gender as 'MALE' | 'FEMALE' | 'OTHER';
  }

  if (minAge || maxAge) {
    where.age = {};
    if (minAge) where.age.gte = parseInt(minAge, 10);
    if (maxAge) where.age.lte = parseInt(maxAge, 10);
  }

  if (minSpent || maxSpent) {
    where.totalSpent = {};
    if (minSpent) where.totalSpent.gte = parseFloat(minSpent);
    if (maxSpent) where.totalSpent.lte = parseFloat(maxSpent);
  }

  if (minOrders) {
    where.totalOrders = { gte: parseInt(minOrders, 10) };
  }

  const validSortFields = [
    'name', 'email', 'city', 'totalSpent', 'totalOrders',
    'lastPurchaseDate', 'joinedDate', 'createdAt', 'age',
  ];
  const orderField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const orderDir = sortOrder === 'asc' ? 'asc' : 'desc';

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { [orderField]: orderDir },
      skip,
      take: limitNum,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        gender: true,
        age: true,
        joinedDate: true,
        totalOrders: true,
        totalSpent: true,
        lastPurchaseDate: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { orders: true, communications: true },
        },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      customers,
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

// GET /api/customers/:id
export const getCustomerById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { purchaseDate: 'desc' },
        take: 10,
      },
      communications: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          campaign: {
            select: { id: true, name: true, channel: true },
          },
          events: {
            orderBy: { timestamp: 'desc' },
          },
        },
      },
      _count: {
        select: { orders: true, communications: true },
      },
    },
  });

  if (!customer) {
    res.status(404).json({ success: false, message: 'Customer not found.' });
    return;
  }

  res.status(200).json({ success: true, data: { customer } });
});

// POST /api/customers
export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, phone, city, gender, age, tags } = req.body;

  const customer = await prisma.customer.create({
    data: {
      name,
      email,
      phone,
      city,
      gender,
      age: age ? parseInt(age, 10) : undefined,
      tags: tags || [],
    },
  });

  res.status(201).json({
    success: true,
    message: 'Customer created successfully.',
    data: { customer },
  });
});

// PUT /api/customers/:id
export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, phone, city, gender, age, tags } = req.body;

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Customer not found.' });
    return;
  }

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(city !== undefined && { city }),
      ...(gender !== undefined && { gender }),
      ...(age !== undefined && { age: parseInt(age, 10) }),
      ...(tags !== undefined && { tags }),
    },
  });

  res.status(200).json({
    success: true,
    message: 'Customer updated successfully.',
    data: { customer },
  });
});

// DELETE /api/customers/:id
export const deleteCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Customer not found.' });
    return;
  }

  await prisma.customer.delete({ where: { id } });

  res.status(200).json({
    success: true,
    message: 'Customer deleted successfully.',
  });
});

// POST /api/customers/import
export const importCustomers = asyncHandler(async (req: Request, res: Response) => {
  const { customers } = req.body;

  if (!Array.isArray(customers) || customers.length === 0) {
    res.status(400).json({ success: false, message: 'Customers array is required.' });
    return;
  }

  const results = {
    created: 0,
    skipped: 0,
    errors: [] as { row: number; email: string; error: string }[],
  };

  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    try {
      await prisma.customer.upsert({
        where: { email: c.email },
        update: {
          name: c.name,
          phone: c.phone,
          city: c.city,
          gender: c.gender,
          age: c.age ? parseInt(c.age, 10) : undefined,
          tags: c.tags || [],
        },
        create: {
          name: c.name,
          email: c.email,
          phone: c.phone,
          city: c.city,
          gender: c.gender,
          age: c.age ? parseInt(c.age, 10) : undefined,
          tags: c.tags || [],
        },
      });
      results.created++;
    } catch {
      results.errors.push({ row: i + 1, email: c.email || 'unknown', error: 'Failed to import' });
      results.skipped++;
    }
  }

  res.status(200).json({
    success: true,
    message: `Import completed: ${results.created} customers processed.`,
    data: results,
  });
});

// GET /api/customers/sample
export const getSampleCustomers = asyncHandler(async (req: Request, res: Response) => {
  const sample = [
    { name: 'Aarav Sharma', email: 'aarav.sharma@example.com', phone: '+91-9876543210', city: 'Mumbai', gender: 'MALE', age: 29, tags: ['premium', 'loyal'] },
    { name: 'Priya Patel', email: 'priya.patel@example.com', phone: '+91-9876543211', city: 'Delhi', gender: 'FEMALE', age: 34, tags: ['new'] },
    { name: 'Rohan Gupta', email: 'rohan.gupta@example.com', phone: '+91-9876543212', city: 'Bangalore', gender: 'MALE', age: 27, tags: ['premium'] },
    { name: 'Sneha Reddy', email: 'sneha.reddy@example.com', phone: '+91-9876543213', city: 'Hyderabad', gender: 'FEMALE', age: 31, tags: ['loyal'] },
    { name: 'Vikram Joshi', email: 'vikram.joshi@example.com', phone: '+91-9876543214', city: 'Pune', gender: 'MALE', age: 42, tags: [] },
  ];

  res.status(200).json({
    success: true,
    message: 'Sample customer data for import testing.',
    data: { sample },
  });
});

// GET /api/customers/stats
export const getCustomerStats = asyncHandler(async (req: Request, res: Response) => {
  const [
    totalCustomers,
    genderBreakdown,
    cityBreakdown,
    avgSpent,
    newThisMonth,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.groupBy({
      by: ['gender'],
      _count: { gender: true },
    }),
    prisma.customer.groupBy({
      by: ['city'],
      _count: { city: true },
      orderBy: { _count: { city: 'desc' } },
      take: 10,
      where: { city: { not: null } },
    }),
    prisma.customer.aggregate({
      _avg: { totalSpent: true, age: true },
      _max: { totalSpent: true },
    }),
    prisma.customer.count({
      where: {
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalCustomers,
      newThisMonth,
      avgSpent: avgSpent._avg.totalSpent || 0,
      avgAge: avgSpent._avg.age || 0,
      maxSpent: avgSpent._max.totalSpent || 0,
      genderBreakdown: genderBreakdown.map((g) => ({
        gender: g.gender || 'UNKNOWN',
        count: g._count.gender,
      })),
      topCities: cityBreakdown.map((c) => ({
        city: c.city,
        count: c._count.city,
      })),
    },
  });
});
