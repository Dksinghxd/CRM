import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';

// Routes
import authRoutes from './routes/auth.routes';
import customerRoutes from './routes/customer.routes';
import orderRoutes from './routes/order.routes';
import segmentRoutes from './routes/segment.routes';
import campaignRoutes from './routes/campaign.routes';
import analyticsRoutes from './routes/analytics.routes';
import aiRoutes from './routes/ai.routes';
import channelRoutes from './routes/channel.routes';

// Middleware
import { errorMiddleware, notFoundHandler } from './middleware/error.middleware';
import prisma from './lib/prisma';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// ─── Trust Proxy (for nginx/load balancer) ───────────────────────────────────
app.set('trust proxy', 1);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (corsOrigins.includes('*') || corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy: ${origin} not allowed`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Request Logging (dev) ────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use((req: Request, _res: Response, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
  });
}

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: 'connected',
        api: 'running',
      },
    });
  } catch {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'disconnected',
        api: 'running',
      },
    });
  }
});

// ─── API Info ─────────────────────────────────────────────────────────────────
app.get('/api', (_req: Request, res: Response) => {
  res.status(200).json({
    name: 'SmartReach AI CRM API',
    version: '1.0.0',
    description: 'AI-powered CRM backend with campaign management and customer analytics',
    endpoints: {
      auth: '/api/auth',
      customers: '/api/customers',
      orders: '/api/orders',
      segments: '/api/segments',
      campaigns: '/api/campaigns',
      analytics: '/api/analytics',
      ai: '/api/ai',
      channel: '/api/channel',
    },
    documentation: 'https://github.com/smartreach-ai/crm-backend',
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/segments', segmentRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/channel', channelRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use(notFoundHandler);

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorMiddleware);

// ─── Start Server ─────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`\n🚀 SmartReach AI CRM Backend started`);
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log(`📋 API:    http://localhost:${PORT}/api`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`\n✅ Ready to handle requests\n`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
const shutdown = async (signal: string) => {
  console.log(`\n${signal} received. Gracefully shutting down...`);

  server.close(async () => {
    console.log('HTTP server closed.');

    try {
      await prisma.$disconnect();
      console.log('Database connection closed.');
    } catch (err) {
      console.error('Error closing database connection:', err);
    }

    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  shutdown('uncaughtException');
});

export default app;
