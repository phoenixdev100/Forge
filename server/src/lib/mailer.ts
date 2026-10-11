/**
 * Transactional email via the user's own SMTP account (nodemailer) - a
 * personal Gmail app password, Outlook, or any hosted relay.
 *
 *   MAIL_PROVIDER=none - dev default; reset links are logged instead of sent.
 *   MAIL_PROVIDER=smtp - sends through SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS.
 *
 * In production with no provider, password reset emails simply cannot arrive.
 * The boot log warns loudly so that misconfiguration is impossible to miss.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';

if (env.isProduction && env.MAIL_PROVIDER === 'none') {
  logger.warn('MAIL_PROVIDER is not configured - password reset requests will succeed silently but no email will arrive');
}

type Mail = { to: string; subject: string; text: string; html: string };

let smtpTransport: Transporter | null = null;

function getSmtpTransport(): Transporter {
  smtpTransport ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // secure=true expects implicit TLS (port 465); false uses STARTTLS (587).
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return smtpTransport;
}

async function sendViaSmtp({ to, subject, text, html }: Mail): Promise<void> {
  await getSmtpTransport().sendMail({ from: env.MAIL_FROM, to, subject, text, html });
}

/** `true` when a provider is configured; `false` when mail is a no-op. */
export function mailConfigured(): boolean {
  return env.MAIL_PROVIDER !== 'none';
}

export async function sendMail(mail: Mail): Promise<void> {
  if (env.MAIL_PROVIDER === 'smtp') return sendViaSmtp(mail);
}

export async function sendPasswordResetEmail(to: string, link: string): Promise<void> {
  const minutes = env.RESET_TOKEN_TTL_MINUTES;
  await sendMail({
    to,
    subject: 'Reset your Forge password',
    text: `Someone requested a password reset for your Forge account.\n\nReset link (valid for ${minutes} minutes):\n${link}\n\nIf this wasn't you, ignore this email - your password stays unchanged.`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
  <h2 style="color:#f97316;margin:0 0 16px">Forge</h2>
  <p>Someone requested a password reset for your account.</p>
  <p><a href="${link}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a></p>
  <p style="color:#666;font-size:13px">This link expires in ${minutes} minutes. If this wasn't you, ignore this email - your password stays unchanged.</p>
</div>`,
  });
}
