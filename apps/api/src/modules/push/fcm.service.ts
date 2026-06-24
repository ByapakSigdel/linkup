import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

/**
 * Firebase Cloud Messaging sender (HTTP v1) with no SDK dependency.
 *
 * Auth: mints a short-lived OAuth2 access token by signing a JWT with the
 * service-account private key (RS256 via Node crypto), exactly like firebase-admin
 * would — so nothing changes in the lockfile / production install.
 *
 * Config: FCM_SERVICE_ACCOUNT_B64 = base64 of the service-account JSON.
 * No-op (returns false) when unconfigured, so message sending never hard-fails.
 */
@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private readonly sa: ServiceAccount | null;
  private accessToken: string | null = null;
  private accessTokenExpiry = 0;

  constructor(private readonly config: ConfigService) {
    this.sa = this.loadServiceAccount();
    if (this.sa) {
      this.logger.log(`FCM ready (project ${this.sa.project_id})`);
    }
  }

  get enabled(): boolean {
    return this.sa !== null;
  }

  private loadServiceAccount(): ServiceAccount | null {
    const b64 = this.config.get<string>('FCM_SERVICE_ACCOUNT_B64', '') || '';
    if (!b64) return null;
    try {
      const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      if (json.client_email && json.private_key && json.project_id) {
        return json;
      }
      this.logger.warn('FCM_SERVICE_ACCOUNT_B64 missing required fields');
      return null;
    } catch (e) {
      this.logger.error(`FCM_SERVICE_ACCOUNT_B64 not valid base64 JSON: ${(e as Error).message}`);
      return null;
    }
  }

  private base64url(input: Buffer | string): string {
    return Buffer.from(input)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private async getAccessToken(): Promise<string | null> {
    if (!this.sa) return null;
    const now = Math.floor(Date.now() / 1000);
    if (this.accessToken && now < this.accessTokenExpiry - 60) {
      return this.accessToken;
    }
    try {
      const header = this.base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
      const claim = this.base64url(
        JSON.stringify({
          iss: this.sa.client_email,
          scope: 'https://www.googleapis.com/auth/firebase.messaging',
          aud: 'https://oauth2.googleapis.com/token',
          iat: now,
          exp: now + 3600,
        }),
      );
      const signingInput = `${header}.${claim}`;
      const signature = crypto.createSign('RSA-SHA256').update(signingInput).sign(this.sa.private_key);
      const jwt = `${signingInput}.${this.base64url(signature)}`;

      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
      });
      if (!res.ok) {
        this.logger.error(`FCM token exchange failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
        return null;
      }
      const data = await res.json();
      this.accessToken = data.access_token;
      this.accessTokenExpiry = now + (data.expires_in ?? 3600);
      return this.accessToken;
    } catch (e) {
      this.logger.error(`FCM token error: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * Send a DATA-ONLY, high-priority message so the app's RNFirebase background
   * handler fires and renders a rich Notifee notification — including the
   * sender's CIRCULAR AVATAR (FCM's own `notification` block has no large-icon
   * field, so the avatar is only achievable by rendering client-side). High
   * priority wakes a killed app's handler on most devices; aggressive OEMs may
   * still need battery-optimization disabled (the app prompts for that). All
   * data values must be strings.
   */
  async sendToToken(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    if (!this.sa || !token) return false;
    const accessToken = await this.getAccessToken();
    if (!accessToken) return false;
    const stringData: Record<string, string> = { title, body };
    for (const [k, v] of Object.entries(data ?? {})) {
      if (v != null) stringData[k] = String(v);
    }
    try {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${this.sa.project_id}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token,
              data: stringData,
              android: { priority: 'high', ttl: '600s' },
            },
          }),
        },
      );
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        this.logger.warn(`FCM send failed (${res.status}): ${errBody.slice(0, 200)}`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.error(`FCM send error: ${(e as Error).message}`);
      return false;
    }
  }
}
