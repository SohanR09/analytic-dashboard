import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(30).default(900),
  REFRESH_TTL_SECONDS: z.coerce.number().int().min(60).default(86_400),
  REFRESH_TTL_REMEMBER_SECONDS: z.coerce.number().int().min(60).default(2_592_000),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  LOGIN_MAX_FAILURES: z.coerce.number().int().min(1).default(5),
  LOGIN_LOCK_SECONDS: z.coerce.number().int().min(1).default(900),
  RATE_LIMIT_ENABLED: bool.default('true'),
  /** Refuse to start (and report not-ready) without Redis. Defaults to true in production. */
  REDIS_REQUIRED: bool.optional(),
  // Outgoing email (password resets). Any SMTP provider works: SES, SendGrid, Mailgun, Postmark, Gmail...
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  /** true = implicit TLS (usually port 465); false = STARTTLS upgrade (usually 587). */
  SMTP_SECURE: bool.default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('Shoplytics <no-reply@localhost>'),
});

const parsed = envSchema
  .superRefine((e, ctx) => {
    if (e.NODE_ENV !== 'production') return;
    // Production must never boot on development defaults.
    const fail = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (/change-me/i.test(e.JWT_ACCESS_SECRET)) fail('JWT_ACCESS_SECRET', 'still the .env.example placeholder - generate a real secret');
    if (!process.env.CLIENT_URL) fail('CLIENT_URL', 'must be set to your frontend origin(s) in production (CORS + password-reset links)');
    if (!process.env.REDIS_URL) fail('REDIS_URL', 'must be set in production');
  })
  .safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  redisRequired: parsed.data.REDIS_REQUIRED ?? parsed.data.NODE_ENV === 'production',
  smtpConfigured: !!parsed.data.SMTP_HOST,
  clientOrigins: parsed.data.CLIENT_URL.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
