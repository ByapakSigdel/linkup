import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly email: EmailService,
  ) {}

  /**
   * Generate, store and deliver a 6-digit verification code. Emails it via
   * Resend when configured (EmailService); always logs it too (dev convenience)
   * and returns it so the caller can surface a dev code when email is disabled.
   */
  async issueVerificationCode(userId: string, email?: string): Promise<{ code: string; sent: boolean }> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    await this.db.insert(schema.verificationCodes).values({
      userId,
      code,
      purpose: 'email_verification',
      expiresAt,
    });
    this.logger.log(`[DEV] Email verification code for ${userId}: ${code}`);
    // Awaited so callers know if delivery actually succeeded; if not, they return
    // a dev code so account creation never gets stuck (e.g. Resend testing mode).
    const sent = email ? await this.email.sendVerificationCode(email, code) : false;
    return { code, sent };
  }

  async verifyEmail(email: string, code: string) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.isVerified) {
      return { verified: true, alreadyVerified: true };
    }

    const [vc] = await this.db
      .select()
      .from(schema.verificationCodes)
      .where(
        and(
          eq(schema.verificationCodes.userId, user.id),
          eq(schema.verificationCodes.code, code),
          isNull(schema.verificationCodes.consumedAt),
        ),
      )
      .orderBy(desc(schema.verificationCodes.createdAt))
      .limit(1);

    if (!vc) {
      throw new BadRequestException('Invalid verification code');
    }
    if (vc.expiresAt < new Date()) {
      throw new BadRequestException('Verification code expired');
    }

    await this.db
      .update(schema.verificationCodes)
      .set({ consumedAt: new Date() })
      .where(eq(schema.verificationCodes.id, vc.id));
    await this.db
      .update(schema.users)
      .set({ isVerified: true, updatedAt: new Date() })
      .where(eq(schema.users.id, user.id));

    return { verified: true };
  }

  async resendVerification(email: string) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.isVerified) {
      return { sent: false, alreadyVerified: true };
    }
    const { code, sent } = await this.issueVerificationCode(user.id, user.email);
    return { sent: true, emailed: sent, devCode: sent ? undefined : code };
  }

  async register(email: string, username: string, displayName: string, password: string) {
    // Check if user exists
    const existingUser = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    // An email that's already registered AND verified is a real duplicate.
    // But an *unverified* row is just an abandoned signup (OTP was sent but never
    // entered) — re-registering should resume it (refresh the details + send a
    // fresh code) rather than dead-end the user with "Email already registered".
    const existing = existingUser[0];
    if (existing && existing.isVerified) {
      throw new ConflictException('Email already registered');
    }

    // The chosen username must be free — unless it's already held by this same
    // unverified row we're about to resume.
    const existingUsername = await this.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);

    if (existingUsername.length > 0 && existingUsername[0]!.id !== existing?.id) {
      throw new ConflictException('Username already taken');
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    let user:
      | { id: string; email: string; username: string; displayName: string }
      | undefined;

    if (existing) {
      // Resume the abandoned signup: overwrite with the latest details so the user
      // isn't stuck on a stale password/username from the half-finished attempt.
      const updated = await this.db
        .update(schema.users)
        .set({ username, displayName, passwordHash, updatedAt: new Date() })
        .where(eq(schema.users.id, existing.id))
        .returning({
          id: schema.users.id,
          email: schema.users.email,
          username: schema.users.username,
          displayName: schema.users.displayName,
        });
      user = updated[0];
    } else {
      // Create user
      const result = await this.db
        .insert(schema.users)
        .values({
          email,
          username,
          displayName,
          passwordHash,
        })
        .returning({
          id: schema.users.id,
          email: schema.users.email,
          username: schema.users.username,
          displayName: schema.users.displayName,
        });
      user = result[0];
    }

    if (!user) {
      throw new Error('Failed to create user');
    }

    // Issue + email an email verification code. The dev code is returned only
    // when delivery actually failed (e.g. Resend testing mode), so we never leak
    // codes once real email is working, but signup is never stuck either.
    const { code: verificationCode, sent } = await this.issueVerificationCode(user.id, user.email);

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user,
      ...tokens,
      emailVerificationRequired: true,
      emailed: sent,
      verificationCode: sent ? undefined : verificationCode,
    };
  }

  async login(email: string, password: string) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
      },
      ...tokens,
    };
  }

  /**
   * Sign in (or transparently create an account) from a Google ID token.
   * The token is verified server-side via Google's tokeninfo endpoint (no SDK
   * dependency). Accounts are linked by verified email, so there's no schema
   * change — a Google sign-in and an email/password signup with the same address
   * resolve to the same user.
   */
  async loginWithGoogle(idToken?: string) {
    if (!idToken) {
      throw new UnauthorizedException('Missing Google credential');
    }

    let payload: any;
    try {
      const res = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      );
      if (!res.ok) {
        throw new Error(`tokeninfo HTTP ${res.status}`);
      }
      payload = await res.json();
    } catch (err) {
      this.logger.warn(`Google token verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Could not verify Google sign-in');
    }

    // Audience check: token must be minted for one of our configured client IDs.
    const allowed = [
      ...(this.configService.get<string>('GOOGLE_CLIENT_ID', '') || '').split(','),
      ...(this.configService.get<string>('GOOGLE_CLIENT_IDS', '') || '').split(','),
    ]
      .map((s) => s.trim())
      .filter(Boolean);
    // Fail CLOSED: if no client IDs are configured, reject — otherwise a token
    // minted for *any* Google client would pass the audience check, letting an
    // attacker sign in as any verified email.
    if (allowed.length === 0 || !allowed.includes(payload.aud)) {
      throw new UnauthorizedException('Google sign-in is not configured for this app');
    }

    const email = String(payload.email || '').toLowerCase();
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    if (!email || !emailVerified) {
      throw new UnauthorizedException('Your Google account has no verified email');
    }

    let [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (!user) {
      const displayName = String(payload.name || email.split('@')[0]).slice(0, 50);
      const username = await this.uniqueUsername(email.split('@')[0]);
      // Random unusable password — the account signs in via Google (or via a
      // future password reset).
      const passwordHash = await bcrypt.hash(`google:${payload.sub}:${username}`, 12);
      const [created] = await this.db
        .insert(schema.users)
        .values({
          email,
          username,
          displayName,
          passwordHash,
          isVerified: true,
          avatarUrl: payload.picture || null,
        })
        .returning();
      user = created;
      this.logger.log(`Created account via Google: ${email}`);
    }

    const tokens = await this.generateTokens(user.id, user.email);
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
      },
      ...tokens,
    };
  }

  /** Derive a schema-valid (3-30, [a-zA-Z0-9_]) username that isn't taken. */
  private async uniqueUsername(base: string): Promise<string> {
    let candidate = (base || 'user').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24);
    if (candidate.length < 3) candidate = `user_${candidate}`;
    for (let i = 0; i < 6; i++) {
      const existing = await this.db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.username, candidate))
        .limit(1);
      if (existing.length === 0) return candidate;
      candidate = `${(base || 'user').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 18)}_${Math.floor(1000 + Math.random() * 9000)}`;
    }
    return `user_${Date.now().toString().slice(-9)}`;
  }

  async validateUser(userId: string) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user || !user.isActive) {
      return null;
    }

    const { passwordHash, ...result } = user;
    return result;
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    // Long-lived sessions: the refresh token lasts ~6 months and rotates on every
    // use, so an active user effectively stays signed in (Discord/Netflix-style)
    // until they explicitly log out. The short access token is refreshed silently.
    const REFRESH_DAYS = 180;
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', `${REFRESH_DAYS}d`),
    });

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_DAYS);

    await this.db.insert(schema.refreshTokens).values({
      userId,
      token: refreshToken,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  async refreshTokens(refreshToken: string) {
    const [stored] = await this.db
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.token, refreshToken))
      .limit(1);

    if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Revoke old token
    await this.db
      .update(schema.refreshTokens)
      .set({ isRevoked: true })
      .where(eq(schema.refreshTokens.id, stored.id));

    const user = await this.validateUser(stored.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.generateTokens(stored.userId, user.email);
  }

  async logout(refreshToken: string) {
    await this.db
      .update(schema.refreshTokens)
      .set({ isRevoked: true })
      .where(eq(schema.refreshTokens.token, refreshToken));
  }
}
