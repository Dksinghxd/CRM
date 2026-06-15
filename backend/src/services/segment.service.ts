import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';

export interface SegmentRule {
  field: string;
  operator: string;
  value: unknown;
}

export interface EvaluateResult {
  customers: Array<{
    id: string;
    name: string;
    email: string;
    city: string | null;
    totalSpent: number;
    totalOrders: number;
    lastPurchaseDate: Date | null;
    age: number | null;
  }>;
  count: number;
}

/**
 * Converts segment filter rules to Prisma WHERE clauses
 */
export const buildWhereClause = (
  rules: SegmentRule[],
  operator: string = 'AND'
): Prisma.CustomerWhereInput => {
  const conditions: Prisma.CustomerWhereInput[] = rules.map((rule) => {
    return buildSingleCondition(rule);
  });

  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0];

  if (operator === 'OR') {
    return { OR: conditions };
  }
  return { AND: conditions };
};

const buildSingleCondition = (rule: SegmentRule): Prisma.CustomerWhereInput => {
  const { field, operator, value } = rule;

  switch (field) {
    case 'totalSpent':
      return buildNumericCondition('totalSpent', operator, value as number);

    case 'totalOrders':
      return buildNumericCondition('totalOrders', operator, value as number);

    case 'age':
      return buildNumericCondition('age', operator, value as number);

    case 'city':
      if (operator === 'eq') {
        return { city: { equals: value as string, mode: 'insensitive' } };
      }
      if (operator === 'neq') {
        return { city: { not: { equals: value as string } } };
      }
      if (operator === 'in') {
        return { city: { in: value as string[] } };
      }
      return { city: { contains: value as string, mode: 'insensitive' } };

    case 'gender':
      return { gender: value as 'MALE' | 'FEMALE' | 'OTHER' };

    case 'lastPurchaseDate':
      return buildDateCondition('lastPurchaseDate', operator, value);

    case 'joinedDate':
      return buildDateCondition('joinedDate', operator, value);

    case 'tags':
      if (operator === 'contains') {
        return { tags: { has: value as string } };
      }
      if (operator === 'in') {
        return { tags: { hasSome: value as string[] } };
      }
      return { tags: { has: value as string } };

    case 'email':
      return { email: { contains: value as string, mode: 'insensitive' } };

    default:
      // Fallback - return empty (match all)
      console.warn(`Unknown segment field: ${field}`);
      return {};
  }
};

const buildNumericCondition = (
  field: 'totalSpent' | 'totalOrders' | 'age',
  operator: string,
  value: number | number[]
): Prisma.CustomerWhereInput => {
  switch (operator) {
    case 'gt':
      return { [field]: { gt: value as number } };
    case 'gte':
      return { [field]: { gte: value as number } };
    case 'lt':
      return { [field]: { lt: value as number } };
    case 'lte':
      return { [field]: { lte: value as number } };
    case 'eq':
      return { [field]: { equals: value as number } };
    case 'neq':
      return { [field]: { not: value as number } };
    case 'between': {
      const [min, max] = value as number[];
      return { [field]: { gte: min, lte: max } };
    }
    default:
      return {};
  }
};

const buildDateCondition = (
  field: 'lastPurchaseDate' | 'joinedDate',
  operator: string,
  value: unknown
): Prisma.CustomerWhereInput => {
  if (operator === 'daysAgo') {
    const days = typeof value === 'number' ? value : parseInt(value as string, 10);
    const date = new Date();
    date.setDate(date.getDate() - days);
    return { [field]: { gte: date } };
  }

  if (operator === 'moreThanDaysAgo') {
    const days = typeof value === 'number' ? value : parseInt(value as string, 10);
    const date = new Date();
    date.setDate(date.getDate() - days);
    return { [field]: { lt: date } };
  }

  if (operator === 'after') {
    return { [field]: { gt: new Date(value as string) } };
  }

  if (operator === 'before') {
    return { [field]: { lt: new Date(value as string) } };
  }

  if (operator === 'between') {
    const [start, end] = value as string[];
    return { [field]: { gte: new Date(start), lte: new Date(end) } };
  }

  return {};
};

/**
 * Evaluate segment rules and return matching customers
 */
export const evaluateSegment = async (
  rules: SegmentRule[],
  operator: string = 'AND',
  page = 1,
  limit = 50
): Promise<EvaluateResult & { page: number; limit: number; totalPages: number }> => {
  const where = buildWhereClause(rules, operator);

  const skip = (page - 1) * limit;

  const [customers, count] = await Promise.all([
    prisma.customer.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        city: true,
        totalSpent: true,
        totalOrders: true,
        lastPurchaseDate: true,
        age: true,
        gender: true,
        tags: true,
      },
      skip,
      take: limit,
      orderBy: { totalSpent: 'desc' },
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    customers,
    count,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
  };
};

/**
 * Count customers matching segment rules (for preview)
 */
export const countSegmentCustomers = async (
  rules: SegmentRule[],
  operator: string = 'AND'
): Promise<number> => {
  const where = buildWhereClause(rules, operator);
  return prisma.customer.count({ where });
};

/**
 * Get all customer IDs matching segment rules (for campaign launch)
 */
export const getSegmentCustomerIds = async (
  rules: SegmentRule[],
  operator: string = 'AND'
): Promise<Array<{ id: string; name: string; email: string }>> => {
  const where = buildWhereClause(rules, operator);

  return prisma.customer.findMany({
    where,
    select: { id: true, name: true, email: true },
  });
};
