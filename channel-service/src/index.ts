// ============================================================
// src/index.ts
// Entry point for the Channel Microservice
// Express server on PORT 5000
// ============================================================

import 'dotenv/config';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import channelRoutes from './routes/channel.routes';

// ─── App Setup ────────────────────────────────────────────────────────────────

const app: Application = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// ─── Middleware ───────────────────────────────────────────────────────────────

// CORS — allow requests from any origin (CRM backend + frontend)
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  })
);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  const start = Date.now();
  _res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[HTTP] ${req.method} ${req.originalUrl} → ${_res.statusCode} (${duration}ms)`
    );
  });
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// Mount all channel routes at root (no prefix — service is standalone)
app.use('/', channelRoutes);

// ─── Root Info Route ──────────────────────────────────────────────────────────

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    service: 'channel-service',
    description: 'SmartReach AI CRM — Channel Microservice',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      'POST /send': 'Queue a message for delivery',
      'POST /receipt': 'Internal delivery receipt webhook',
      'GET /health': 'Health check with queue stats',
      'GET /queue/status': 'Detailed queue status',
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `Route ${_req.method} ${_req.originalUrl} not found`,
    statusCode: 404,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[SERVER] Unhandled error:', err.message, err.stack);
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred',
    statusCode: 500,
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║        SmartReach AI — Channel Microservice          ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  🚀 Server running on port ${PORT}                      ║`);
  console.log(`║  📡 Callback URL: ${process.env.BACKEND_CALLBACK_URL || 'http://localhost:4000/api/channel/receipt'}`);
  console.log(`║  🌍 Environment: ${process.env.NODE_ENV || 'development'}                    ║`);
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Available endpoints:');
  console.log(`  POST http://localhost:${PORT}/send`);
  console.log(`  POST http://localhost:${PORT}/receipt`);
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log(`  GET  http://localhost:${PORT}/queue/status`);
  console.log('');
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

function gracefulShutdown(signal: string): void {
  console.log(`\n[SERVER] Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('[SERVER] HTTP server closed. Goodbye! 👋');
    process.exit(0);
  });

  // Force shutdown after 10 seconds if server doesn't close
  setTimeout(() => {
    console.error('[SERVER] Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  console.error('[SERVER] Unhandled Promise Rejection:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.error('[SERVER] Uncaught Exception:', err.message, err.stack);
  process.exit(1);
});

export default app;
