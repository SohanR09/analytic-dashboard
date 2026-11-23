import { createApp } from './app';
import { connectDB, disconnectDB } from './config/prisma';
import { connectRedis, disconnectRedis } from './config/redis';
import { env } from './config/env';
import { closePdfPool } from './services/pdf.pool';

async function main() {
  await Promise.all([connectDB(), connectRedis()]);
  if (env.isProduction && !env.smtpConfigured) {
    console.warn('[email] SMTP_HOST is not set - password-reset emails will NOT be delivered.');
  }
  if (env.isProduction && env.TRUST_PROXY === 0) {
    console.warn('[config] TRUST_PROXY=0 - if this API sits behind a reverse proxy / load balancer, set TRUST_PROXY=1 or all clients share one rate limit.');
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`Shoplytics API listening on http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      await Promise.allSettled([disconnectDB(), disconnectRedis(), closePdfPool()]);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
