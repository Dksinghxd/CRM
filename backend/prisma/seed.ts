import 'dotenv/config';
import { PrismaClient, Gender, OrderChannel, OrderStatus, CampaignChannel, CampaignStatus, CommunicationStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

// ─── Helper Functions ─────────────────────────────────────────────────────────

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randomFloat = (min: number, max: number) =>
  parseFloat((Math.random() * (max - min) + min).toFixed(2));

const randomChoice = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const randomDate = (start: Date, end: Date): Date =>
  new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

const randomBool = (probability = 0.5) => Math.random() < probability;

// ─── Data Pools ───────────────────────────────────────────────────────────────

const FIRST_NAMES_MALE = [
  'Aarav', 'Arjun', 'Vivek', 'Rahul', 'Rohan', 'Karan', 'Amit', 'Vijay',
  'Sanjay', 'Nikhil', 'Deepak', 'Manish', 'Pradeep', 'Suresh', 'Ramesh',
  'Anil', 'Pankaj', 'Gaurav', 'Vikram', 'Tarun', 'Mohit', 'Ankit', 'Ravi',
  'Sachin', 'Varun', 'Harsh', 'Sumit', 'Ajay', 'Dinesh', 'Rajesh',
];

const FIRST_NAMES_FEMALE = [
  'Priya', 'Anjali', 'Sneha', 'Pooja', 'Neha', 'Kavya', 'Riya', 'Sonia',
  'Divya', 'Meera', 'Sunita', 'Lakshmi', 'Ananya', 'Ishita', 'Kritika',
  'Swati', 'Nidhi', 'Preeti', 'Rekha', 'Seema', 'Tanvi', 'Nisha', 'Smita',
  'Pallavi', 'Jyoti', 'Asha', 'Kiran', 'Madhuri', 'Archana', 'Vandana',
];

const LAST_NAMES = [
  'Sharma', 'Patel', 'Gupta', 'Singh', 'Kumar', 'Verma', 'Joshi', 'Mehta',
  'Shah', 'Agarwal', 'Reddy', 'Nair', 'Iyer', 'Pillai', 'Rao', 'Mishra',
  'Pandey', 'Tiwari', 'Chaudhary', 'Saxena', 'Srivastava', 'Bhatt', 'Desai',
  'Jain', 'Kapoor', 'Malhotra', 'Khanna', 'Chopra', 'Bose', 'Chatterjee',
];

const CITIES = [
  'Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune',
  'Ahmedabad', 'Jaipur', 'Surat', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore',
  'Bhopal', 'Visakhapatnam', 'Pimpri', 'Patna', 'Vadodara', 'Ghaziabad',
];

const CATEGORIES = [
  'Electronics', 'Clothing', 'Footwear', 'Books', 'Home & Kitchen',
  'Beauty & Health', 'Sports & Fitness', 'Toys', 'Grocery', 'Jewellery',
  'Furniture', 'Automotive', 'Garden', 'Pet Supplies', 'Music',
];

const TAGS = [
  'premium', 'loyal', 'new', 'vip', 'deal-seeker', 'impulse-buyer',
  'seasonal', 'B2B', 'influencer', 'referral', 'newsletter',
];

// ─── Generate Customers ───────────────────────────────────────────────────────

interface CustomerSeed {
  name: string;
  email: string;
  phone: string;
  city: string;
  gender: Gender;
  age: number;
  joinedDate: Date;
  tags: string[];
  totalOrders: number;
  totalSpent: number;
  lastPurchaseDate: Date | null;
}

function generateCustomer(index: number): CustomerSeed {
  const gender: Gender = randomBool(0.52) ? 'MALE' : randomBool(0.92) ? 'FEMALE' : 'OTHER';
  const firstName =
    gender === 'MALE'
      ? randomChoice(FIRST_NAMES_MALE)
      : gender === 'FEMALE'
      ? randomChoice(FIRST_NAMES_FEMALE)
      : randomChoice([...FIRST_NAMES_MALE, ...FIRST_NAMES_FEMALE]);
  const lastName = randomChoice(LAST_NAMES);
  const name = `${firstName} ${lastName}`;

  const emailDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'rediffmail.com'];
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@${randomChoice(emailDomains)}`;

  const phonePrefix = randomChoice(['+91-98', '+91-97', '+91-96', '+91-89', '+91-70', '+91-80']);
  const phone = `${phonePrefix}${randomInt(10000000, 99999999)}`;

  const city = randomChoice(CITIES);
  const age = randomInt(18, 65);

  const joinedDate = randomDate(new Date('2022-01-01'), new Date('2025-06-01'));

  // Assign tags
  const numTags = randomInt(0, 3);
  const shuffledTags = TAGS.sort(() => Math.random() - 0.5);
  const tags = shuffledTags.slice(0, numTags);

  // Will be computed from orders, but set placeholder for high-value customers
  const totalOrders = 0;
  const totalSpent = 0;

  return {
    name,
    email,
    phone,
    city,
    gender,
    age,
    joinedDate,
    tags,
    totalOrders,
    totalSpent,
    lastPurchaseDate: null,
  };
}

// ─── Generate Orders ──────────────────────────────────────────────────────────

interface OrderSeed {
  amount: number;
  category: string;
  purchaseDate: Date;
  channel: OrderChannel;
  status: OrderStatus;
}

function generateOrders(joinedDate: Date, numOrders: number): OrderSeed[] {
  const orders: OrderSeed[] = [];
  const channelWeights: OrderChannel[] = ['ONLINE', 'ONLINE', 'ONLINE', 'OFFLINE', 'MOBILE_APP'];
  const statusWeights: OrderStatus[] = [
    'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED',
    'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED',
    'PENDING', 'CANCELLED', 'REFUNDED',
  ];

  for (let i = 0; i < numOrders; i++) {
    const purchaseDate = randomDate(joinedDate, new Date());
    const status = randomChoice(statusWeights);
    const category = randomChoice(CATEGORIES);

    let amount: number;
    switch (category) {
      case 'Electronics': amount = randomFloat(2000, 80000); break;
      case 'Furniture': amount = randomFloat(3000, 50000); break;
      case 'Jewellery': amount = randomFloat(1000, 200000); break;
      case 'Grocery': amount = randomFloat(200, 3000); break;
      case 'Books': amount = randomFloat(100, 1500); break;
      default: amount = randomFloat(300, 15000);
    }

    orders.push({
      amount,
      category,
      purchaseDate,
      channel: randomChoice(channelWeights),
      status,
    });
  }

  return orders;
}

// ─── Main Seed Function ───────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Clear existing data (in dependency order)
  console.log('🗑️  Clearing existing data...');
  await prisma.communicationEvent.deleteMany();
  await prisma.communication.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.segment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  console.log('✅ Existing data cleared\n');

  // ─── Create Admin User ──────────────────────────────────────────────
  console.log('👤 Creating admin user...');
  const hashedPassword = await bcrypt.hash('Admin@123', 12);
  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@smartreach.ai',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  // Create a manager user too
  const managerUser = await prisma.user.create({
    data: {
      name: 'Priya Sharma',
      email: 'manager@smartreach.ai',
      password: await bcrypt.hash('Manager@123', 12),
      role: 'MANAGER',
    },
  });

  console.log(`✅ Created users: admin@smartreach.ai / Admin@123`);
  console.log(`✅ Created users: manager@smartreach.ai / Manager@123\n`);

  // ─── Create 100 Customers ────────────────────────────────────────────
  console.log('👥 Creating 100 customers...');

  const customerSeeds: CustomerSeed[] = Array.from({ length: 100 }, (_, i) =>
    generateCustomer(i + 1)
  );

  // Create customers in DB
  const createdCustomers = await Promise.all(
    customerSeeds.map((c) =>
      prisma.customer.create({
        data: {
          name: c.name,
          email: c.email,
          phone: c.phone,
          city: c.city,
          gender: c.gender,
          age: c.age,
          joinedDate: c.joinedDate,
          tags: c.tags,
        },
      })
    )
  );

  console.log(`✅ Created ${createdCustomers.length} customers\n`);

  // ─── Create 500 Orders ───────────────────────────────────────────────
  console.log('📦 Creating 500 orders...');

  const customerOrderCounts: Record<string, number> = {};

  // Distribute 500 orders across 100 customers (Pareto-ish distribution)
  const orderDistribution = createdCustomers.map((c, i) => {
    // Top 20 customers get 40% of orders, rest share the remaining
    const isHighValue = i < 20;
    const orders = isHighValue ? randomInt(8, 20) : randomInt(1, 6);
    customerOrderCounts[c.id] = orders;
    return orders;
  });

  // Normalize to exactly 500
  const totalOrders = orderDistribution.reduce((sum, n) => sum + n, 0);
  const scale = 500 / totalOrders;
  const finalCounts = orderDistribution.map((n) => Math.max(1, Math.round(n * scale)));

  // Adjust to ensure exactly 500
  const currentTotal = finalCounts.reduce((sum, n) => sum + n, 0);
  const diff = 500 - currentTotal;
  if (diff > 0) {
    for (let i = 0; i < diff; i++) {
      finalCounts[i % finalCounts.length]++;
    }
  } else if (diff < 0) {
    for (let i = 0; i < Math.abs(diff); i++) {
      if (finalCounts[i % finalCounts.length] > 1) {
        finalCounts[i % finalCounts.length]--;
      }
    }
  }

  let totalOrdersCreated = 0;

  for (let ci = 0; ci < createdCustomers.length; ci++) {
    const customer = createdCustomers[ci];
    const numOrders = finalCounts[ci];
    const orderSeeds = generateOrders(customer.joinedDate, numOrders);

    const createdOrders = await prisma.order.createMany({
      data: orderSeeds.map((o) => ({
        customerId: customer.id,
        amount: o.amount,
        category: o.category,
        purchaseDate: o.purchaseDate,
        channel: o.channel,
        status: o.status,
      })),
    });

    totalOrdersCreated += createdOrders.count;

    // Update customer aggregates
    const stats = await prisma.order.aggregate({
      where: { customerId: customer.id, status: 'COMPLETED' },
      _sum: { amount: true },
      _count: { id: true },
      _max: { purchaseDate: true },
    });

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        totalOrders: stats._count.id,
        totalSpent: stats._sum.amount || 0,
        lastPurchaseDate: stats._max.purchaseDate,
      },
    });
  }

  console.log(`✅ Created ${totalOrdersCreated} orders\n`);

  // ─── Create Segments ─────────────────────────────────────────────────
  console.log('🎯 Creating segments...');

  const segment1 = await prisma.segment.create({
    data: {
      name: 'High-Value Premium Customers',
      description: 'Customers who have spent more than ₹10,000 with 3+ orders',
      rules: [
        { field: 'totalSpent', operator: 'gt', value: 10000 },
        { field: 'totalOrders', operator: 'gte', value: 3 },
      ],
      operator: 'AND',
      aiGenerated: false,
    },
  });

  const segment2 = await prisma.segment.create({
    data: {
      name: 'Lapsed Customers — Delhi & Mumbai',
      description: 'Customers in Delhi or Mumbai who have not purchased in 60+ days',
      rules: [
        { field: 'city', operator: 'in', value: ['Delhi', 'Mumbai'] },
        { field: 'lastPurchaseDate', operator: 'moreThanDaysAgo', value: 60 },
        { field: 'totalOrders', operator: 'gt', value: 0 },
      ],
      operator: 'AND',
      aiGenerated: false,
    },
  });

  const segment3 = await prisma.segment.create({
    data: {
      name: 'Young Active Shoppers',
      description: 'Customers aged 18-30 who purchased in the last 30 days',
      rules: [
        { field: 'age', operator: 'between', value: [18, 30] },
        { field: 'lastPurchaseDate', operator: 'daysAgo', value: 90 },
      ],
      operator: 'AND',
      aiGenerated: false,
    },
  });

  const segment4 = await prisma.segment.create({
    data: {
      name: 'AI: Loyal Repeat Buyers',
      description: 'AI-generated segment targeting highly loyal customers with frequent purchases',
      rules: [
        { field: 'totalOrders', operator: 'gt', value: 5 },
        { field: 'totalSpent', operator: 'gt', value: 5000 },
        { field: 'lastPurchaseDate', operator: 'daysAgo', value: 60 },
      ],
      operator: 'AND',
      aiGenerated: true,
      aiPrompt: 'Find loyal customers who frequently purchase and have spent a significant amount recently',
    },
  });

  // Simple count without importing service (use raw Prisma)
  const s1Count = await prisma.customer.count({
    where: { totalSpent: { gt: 10000 }, totalOrders: { gte: 3 } },
  });
  const s2Count = await prisma.customer.count({
    where: {
      city: { in: ['Delhi', 'Mumbai'] },
      lastPurchaseDate: { lt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
      totalOrders: { gt: 0 },
    },
  });
  const s3Count = await prisma.customer.count({
    where: {
      age: { gte: 18, lte: 30 },
      lastPurchaseDate: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
  });
  const s4Count = await prisma.customer.count({
    where: {
      totalOrders: { gt: 5 },
      totalSpent: { gt: 5000 },
      lastPurchaseDate: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
    },
  });

  await Promise.all([
    prisma.segment.update({ where: { id: segment1.id }, data: { customerCount: s1Count } }),
    prisma.segment.update({ where: { id: segment2.id }, data: { customerCount: s2Count } }),
    prisma.segment.update({ where: { id: segment3.id }, data: { customerCount: s3Count } }),
    prisma.segment.update({ where: { id: segment4.id }, data: { customerCount: s4Count } }),
  ]);

  console.log(`✅ Created 4 segments`);
  console.log(`   - High-Value Premium: ${s1Count} customers`);
  console.log(`   - Lapsed Delhi/Mumbai: ${s2Count} customers`);
  console.log(`   - Young Active: ${s3Count} customers`);
  console.log(`   - AI Loyal Repeat: ${s4Count} customers\n`);

  // ─── Create Campaigns ────────────────────────────────────────────────
  console.log('📢 Creating campaigns...');

  const campaign1 = await prisma.campaign.create({
    data: {
      name: 'Diwali Mega Sale 2025',
      segmentId: segment1.id,
      channel: 'EMAIL' as CampaignChannel,
      subject: '🪔 Exclusive Diwali Deals Just for You — Up to 60% Off!',
      headline: 'Celebrate Diwali with Exclusive Savings',
      message:
        'Dear Valued Customer,\n\nThis Diwali, we have curated special offers exclusively for our premium members like you. Enjoy up to 60% off on electronics, home decor, and jewellery. Use code DIWALI25 at checkout.\n\nHurry, offer valid till 31st October!',
      cta: 'Shop Diwali Sale',
      goal: 'Drive sales during festive season',
      tone: 'festive',
      status: 'COMPLETED' as CampaignStatus,
      launchedAt: new Date('2025-10-15T10:00:00Z'),
      completedAt: new Date('2025-10-15T12:30:00Z'),
      userId: adminUser.id,
      totalSent: s1Count > 0 ? s1Count : 25,
      totalDelivered: s1Count > 0 ? Math.floor(s1Count * 0.95) : 24,
      totalFailed: s1Count > 0 ? Math.ceil(s1Count * 0.05) : 1,
      totalOpened: s1Count > 0 ? Math.floor(s1Count * 0.42) : 11,
      totalClicked: s1Count > 0 ? Math.floor(s1Count * 0.18) : 5,
      totalConverted: s1Count > 0 ? Math.floor(s1Count * 0.08) : 2,
    },
  });

  const campaign2 = await prisma.campaign.create({
    data: {
      name: 'Win Back Lapsed Users — Delhi Mumbai',
      segmentId: segment2.id,
      channel: 'SMS' as CampaignChannel,
      message:
        'Hi {name}! We miss you! 😊 Come back and get 20% off your next order with code COMEBACK20. Valid for 48 hours. Shop now: smartreach.ai/shop',
      cta: 'Claim Offer',
      goal: 'Re-engage lapsed customers',
      tone: 'friendly',
      status: 'COMPLETED' as CampaignStatus,
      launchedAt: new Date('2025-11-01T09:00:00Z'),
      completedAt: new Date('2025-11-01T09:45:00Z'),
      userId: managerUser.id,
      totalSent: s2Count > 0 ? s2Count : 18,
      totalDelivered: s2Count > 0 ? Math.floor(s2Count * 0.98) : 18,
      totalFailed: 0,
      totalOpened: 0,
      totalClicked: s2Count > 0 ? Math.floor(s2Count * 0.12) : 2,
      totalConverted: s2Count > 0 ? Math.floor(s2Count * 0.05) : 1,
    },
  });

  const campaign3 = await prisma.campaign.create({
    data: {
      name: 'New Year New Arrivals — Young Shoppers',
      segmentId: segment3.id,
      channel: 'WHATSAPP' as CampaignChannel,
      headline: 'New Year, New Style! 🎉',
      message:
        'Happy New Year! 🥂 Check out our fresh arrivals — trending styles picked just for you. First 100 orders get FREE delivery + a surprise gift! Tap to explore 👆',
      cta: 'Explore New Arrivals',
      goal: 'Promote new collection to young audience',
      tone: 'casual',
      status: 'RUNNING' as CampaignStatus,
      launchedAt: new Date('2026-01-01T08:00:00Z'),
      userId: adminUser.id,
      totalSent: s3Count > 0 ? Math.floor(s3Count * 0.8) : 20,
      totalDelivered: s3Count > 0 ? Math.floor(s3Count * 0.75) : 19,
      totalFailed: s3Count > 0 ? Math.floor(s3Count * 0.05) : 1,
      totalOpened: s3Count > 0 ? Math.floor(s3Count * 0.55) : 14,
      totalClicked: s3Count > 0 ? Math.floor(s3Count * 0.25) : 6,
      totalConverted: s3Count > 0 ? Math.floor(s3Count * 0.10) : 3,
    },
  });

  const campaign4 = await prisma.campaign.create({
    data: {
      name: 'VIP Loyalty Rewards Q1 2026',
      segmentId: segment4.id,
      channel: 'EMAIL' as CampaignChannel,
      subject: '🌟 You\'re a VIP! Exclusive Loyalty Rewards Inside',
      headline: 'Thank You for Being Loyal — Here\'s Your Reward',
      message:
        'Dear Valued Customer,\n\nAs one of our most loyal shoppers, you\'ve earned exclusive VIP rewards for Q1 2026:\n\n✅ ₹500 cashback on orders above ₹3,000\n✅ Early access to new collections\n✅ Free express shipping on all orders\n\nYour rewards are valid until March 31, 2026.',
      cta: 'Claim VIP Rewards',
      goal: 'Reward and retain top loyal customers',
      tone: 'formal',
      status: 'DRAFT' as CampaignStatus,
      userId: adminUser.id,
    },
  });

  console.log(`✅ Created 4 campaigns\n`);

  // ─── Create Communications & Events ─────────────────────────────────
  console.log('📨 Creating communications and events...');

  // Get customers for completed campaigns
  const highValueCustomers = await prisma.customer.findMany({
    where: { totalSpent: { gt: 10000 }, totalOrders: { gte: 3 } },
    take: 30,
  });

  const lapsedCustomers = await prisma.customer.findMany({
    where: {
      city: { in: ['Delhi', 'Mumbai'] },
      totalOrders: { gt: 0 },
    },
    take: 25,
  });

  const youngCustomers = await prisma.customer.findMany({
    where: { age: { gte: 18, lte: 30 } },
    take: 20,
  });

  // Helper to pick random status for "completed" campaign
  const randomCompletedStatus = (): CommunicationStatus => {
    const rand = Math.random();
    if (rand < 0.05) return 'FAILED';
    if (rand < 0.15) return 'DELIVERED';
    if (rand < 0.35) return 'SENT';
    if (rand < 0.60) return 'OPENED';
    if (rand < 0.82) return 'CLICKED';
    return 'CONVERTED';
  };

  // Campaign 1 communications (EMAIL, COMPLETED)
  const campaign1Customers = highValueCustomers.slice(0, Math.min(highValueCustomers.length, campaign1.totalSent));
  for (const customer of campaign1Customers) {
    const status = randomCompletedStatus();
    const comm = await prisma.communication.create({
      data: {
        campaignId: campaign1.id,
        customerId: customer.id,
        channel: 'EMAIL',
        status,
        message: campaign1.message,
        externalId: `ext_${Math.random().toString(36).substring(2, 10)}`,
      },
    });

    // Create events for this communication
    const events: Array<{ event: string; timestamp: Date; metadata?: Record<string, unknown> }> = [
      { event: 'sent', timestamp: new Date('2025-10-15T10:05:00Z') },
    ];

    if (!['FAILED', 'SENT'].includes(status)) {
      events.push({ event: 'delivered', timestamp: new Date('2025-10-15T10:10:00Z') });
    }
    if (['OPENED', 'READ', 'CLICKED', 'CONVERTED'].includes(status)) {
      events.push({
        event: 'opened',
        timestamp: randomDate(new Date('2025-10-15T10:15:00Z'), new Date('2025-10-16T10:00:00Z')),
        metadata: { device: randomChoice(['mobile', 'desktop', 'tablet']), location: customer.city },
      });
    }
    if (['CLICKED', 'CONVERTED'].includes(status)) {
      events.push({
        event: 'clicked',
        timestamp: randomDate(new Date('2025-10-15T11:00:00Z'), new Date('2025-10-17T00:00:00Z')),
        metadata: { link: 'https://smartreach.ai/shop/diwali', cta: 'Shop Diwali Sale' },
      });
    }
    if (status === 'CONVERTED') {
      events.push({
        event: 'converted',
        timestamp: randomDate(new Date('2025-10-15T12:00:00Z'), new Date('2025-10-20T00:00:00Z')),
        metadata: { orderValue: randomFloat(1500, 15000), orderId: `ORD-${randomInt(10000, 99999)}` },
      });
    }
    if (status === 'FAILED') {
      events.push({ event: 'failed', timestamp: new Date('2025-10-15T10:06:00Z'), metadata: { reason: 'Bounced' } });
    }

    for (const e of events) {
      await prisma.communicationEvent.create({
        data: {
          communicationId: comm.id,
          event: e.event,
          timestamp: e.timestamp,
          metadata: e.metadata || null,
        },
      });
    }
  }

  // Campaign 2 communications (SMS, COMPLETED)
  const campaign2Customers = lapsedCustomers.slice(0, Math.min(lapsedCustomers.length, campaign2.totalSent));
  for (const customer of campaign2Customers) {
    const rand = Math.random();
    const status: CommunicationStatus = rand < 0.02 ? 'FAILED' : rand < 0.88 ? 'DELIVERED' : rand < 0.95 ? 'CLICKED' : 'CONVERTED';
    const comm = await prisma.communication.create({
      data: {
        campaignId: campaign2.id,
        customerId: customer.id,
        channel: 'SMS',
        status,
        message: `Hi ${customer.name.split(' ')[0]}! We miss you! Get 20% off with code COMEBACK20.`,
        externalId: `sms_${Math.random().toString(36).substring(2, 10)}`,
      },
    });

    const events: Array<{ event: string; timestamp: Date; metadata?: Record<string, unknown> }> = [
      { event: 'sent', timestamp: new Date('2025-11-01T09:05:00Z') },
      { event: 'delivered', timestamp: new Date('2025-11-01T09:06:00Z') },
    ];

    if (['CLICKED', 'CONVERTED'].includes(status)) {
      events.push({ event: 'clicked', timestamp: randomDate(new Date('2025-11-01T09:10:00Z'), new Date('2025-11-02T23:59:00Z')) });
    }
    if (status === 'CONVERTED') {
      events.push({
        event: 'converted',
        timestamp: randomDate(new Date('2025-11-01T10:00:00Z'), new Date('2025-11-03T23:59:00Z')),
        metadata: { orderValue: randomFloat(500, 5000) },
      });
    }

    for (const e of events) {
      await prisma.communicationEvent.create({
        data: { communicationId: comm.id, event: e.event, timestamp: e.timestamp, metadata: e.metadata || null },
      });
    }
  }

  // Campaign 3 communications (WHATSAPP, RUNNING)
  const campaign3Customers = youngCustomers.slice(0, Math.min(youngCustomers.length, campaign3.totalSent));
  for (const customer of campaign3Customers) {
    const rand = Math.random();
    const status: CommunicationStatus = rand < 0.05 ? 'FAILED' : rand < 0.15 ? 'SENT' : rand < 0.30 ? 'DELIVERED' : rand < 0.55 ? 'OPENED' : rand < 0.80 ? 'CLICKED' : 'CONVERTED';
    const comm = await prisma.communication.create({
      data: {
        campaignId: campaign3.id,
        customerId: customer.id,
        channel: 'WHATSAPP',
        status,
        message: `Happy New Year! 🥂 Check out our fresh arrivals just for you!`,
        externalId: `wa_${Math.random().toString(36).substring(2, 10)}`,
      },
    });

    const events: Array<{ event: string; timestamp: Date }> = [{ event: 'sent', timestamp: new Date('2026-01-01T08:05:00Z') }];
    if (!['FAILED', 'SENT'].includes(status)) events.push({ event: 'delivered', timestamp: new Date('2026-01-01T08:07:00Z') });
    if (['OPENED', 'CLICKED', 'CONVERTED'].includes(status)) events.push({ event: 'opened', timestamp: new Date('2026-01-01T09:00:00Z') });
    if (['CLICKED', 'CONVERTED'].includes(status)) events.push({ event: 'clicked', timestamp: new Date('2026-01-01T09:30:00Z') });
    if (status === 'CONVERTED') events.push({ event: 'converted', timestamp: new Date('2026-01-01T10:00:00Z') });

    for (const e of events) {
      await prisma.communicationEvent.create({
        data: { communicationId: comm.id, event: e.event, timestamp: e.timestamp },
      });
    }
  }

  const totalComms = await prisma.communication.count();
  const totalEvents = await prisma.communicationEvent.count();
  console.log(`✅ Created ${totalComms} communications with ${totalEvents} events\n`);

  // ─── Final Summary ───────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════');
  console.log('🎉 Database seed completed successfully!\n');
  console.log('📊 Summary:');
  console.log(`   Users:          2  (admin + manager)`);
  console.log(`   Customers:      ${await prisma.customer.count()}`);
  console.log(`   Orders:         ${await prisma.order.count()}`);
  console.log(`   Segments:       ${await prisma.segment.count()}`);
  console.log(`   Campaigns:      ${await prisma.campaign.count()}`);
  console.log(`   Communications: ${totalComms}`);
  console.log(`   Events:         ${totalEvents}`);
  console.log('\n🔑 Login Credentials:');
  console.log('   Admin:   admin@smartreach.ai   / Admin@123');
  console.log('   Manager: manager@smartreach.ai / Manager@123');
  console.log('═══════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
