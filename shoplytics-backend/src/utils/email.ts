import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';

/**
 * Outgoing email over SMTP (works with SES, SendGrid, Mailgun, Postmark, Gmail, ... - set SMTP_* in the env).
 * Without SMTP_HOST: outside production the reset link is printed to the console so the flow can be tested;
 * in production a warning is logged (the user simply never receives the email).
 */

let transporter: Transporter | undefined;

const getTransporter = (): Transporter =>
  (transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
  }));

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!env.smtpConfigured) {
    if (!env.isProduction) {
      if (env.NODE_ENV !== 'test') console.log(`[email:stub] Password reset for ${to}: ${resetUrl}`);
      return;
    }
    console.warn('[email] SMTP_HOST is not configured - a password-reset email was NOT sent.');
    return;
  }

  await getTransporter().sendMail({
    from: env.EMAIL_FROM,
    to,
    subject: 'Reset your Shoplytics password',
    text: `We received a request to reset your Shoplytics password.\n\nOpen this link to choose a new one (it expires soon and works once):\n${resetUrl}\n\nIf you did not ask for this, you can ignore this email.`,
    html: `<p>We received a request to reset your Shoplytics password.</p><p><a href="${resetUrl}">Choose a new password</a> (the link expires soon and works once).</p><p>If you did not ask for this, you can ignore this email.</p>`,
  });
}
