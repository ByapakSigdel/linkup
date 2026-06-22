import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Transactional email via Resend (https://resend.com).
 *
 * Uses Resend's HTTP API through Node's built-in `fetch` — no SDK dependency, so
 * nothing changes in the lockfile / production install. Sending is best-effort:
 * if RESEND_API_KEY is not configured the call is a no-op (and the caller still
 * has the dev code), so account creation never hard-fails on email delivery.
 *
 * Env:
 *   RESEND_API_KEY  — Resend API key (sending disabled when empty)
 *   EMAIL_FROM      — verified sender, e.g. "LinkUp <noreply@linkup.mahansigdel.com.np>"
 *                     (defaults to Resend's onboarding sender for quick testing)
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('RESEND_API_KEY', '') || '';
    this.from = this.config.get<string>('EMAIL_FROM', 'LinkUp <onboarding@resend.dev>') || 'LinkUp <onboarding@resend.dev>';
  }

  get enabled(): boolean {
    return this.apiKey.length > 0;
  }

  /** Send the 6-digit account-verification code. Returns true if delivered. */
  async sendVerificationCode(to: string, code: string): Promise<boolean> {
    return this.send(to, 'Your LinkUp verification code', verificationEmailHtml(code), verificationEmailText(code));
  }

  /** Generic send. Resolves false (never throws) so callers can fire-and-forget. */
  async send(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    if (!this.enabled) {
      this.logger.warn(`RESEND_API_KEY not set — skipping email to ${to} ("${subject}")`);
      return false;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: this.from, to: [to], subject, html, text }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(`Resend send to ${to} failed (${res.status}): ${body.slice(0, 300)}`);
        return false;
      }
      this.logger.log(`Email sent to ${to} ("${subject}")`);
      return true;
    } catch (err) {
      this.logger.error(`Resend send to ${to} errored: ${(err as Error).message}`);
      return false;
    }
  }
}

/** Branded midnight-constellation OTP email. */
function verificationEmailHtml(code: string): string {
  const spaced = code.split('').join('&nbsp;&nbsp;');
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#070a11;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070a11;padding:40px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#0d1119;border:1px solid #1a2130;border-radius:18px;overflow:hidden;">
          <tr><td style="height:3px;background:linear-gradient(90deg,transparent,#aec5d8,transparent);"></td></tr>
          <tr><td style="padding:36px 36px 8px 36px;text-align:center;">
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#ece8e0;letter-spacing:0.3px;">LinkUp</div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#aab3c4;letter-spacing:2px;text-transform:uppercase;margin-top:6px;">verify your email</div>
          </td></tr>
          <tr><td style="padding:18px 36px 6px 36px;text-align:center;">
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#aab3c4;margin:0;">
              Enter this code to finish creating your account. It expires in 15 minutes.
            </p>
          </td></tr>
          <tr><td style="padding:24px 36px;text-align:center;">
            <div style="display:inline-block;background:#11161f;border:1px solid #2a3140;border-radius:14px;padding:16px 28px;font-family:'Courier New',monospace;font-size:30px;font-weight:bold;letter-spacing:6px;color:#ece8e0;">${spaced}</div>
          </td></tr>
          <tr><td style="padding:6px 36px 36px 36px;text-align:center;">
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b7689;margin:0;">
              If you didn't create a LinkUp account, you can safely ignore this email.
            </p>
          </td></tr>
        </table>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#46506180;color:#465061;margin-top:18px;">your constellation of two</div>
      </td></tr>
    </table>
  </body>
</html>`;
}

function verificationEmailText(code: string): string {
  return `LinkUp — verify your email\n\nYour verification code is: ${code}\nIt expires in 15 minutes.\n\nIf you didn't create a LinkUp account, you can ignore this email.`;
}
