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
  async issueVerificationCode(userId: string, email?: string): Promise<string> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    await this.db.insert(schema.verificationCodes).values({
      userId,
      code,
      purpose: 'email_verification',
      expiresAt,
    });
    this.logger.log(`[DEV] Email verification code for ${userId}: ${code}`);
    if (email) {
      // Best-effort — never block account creation on email delivery.
      void this.email.sendVerificationCode(email, code);
    }
    return code;
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
    const code = await this.issueVerificationCode(user.id, user.email);
    return { sent: true, emailed: this.email.enabled, devCode: this.email.enabled ? undefined : code };
  }

  async register(email: string, username: string, displayName: string, password: string) {
    // Check if user exists
    const existingUser = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      throw new ConflictException('Email already registered');
    }

    const existingUsername = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);

    if (existingUsername.length > 0) {
      throw new ConflictException('Username already taken');
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

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

    const user = result[0];
    if (!user) {
      throw new Error('Failed to create user');
    }

    // Issue + email an email verification code (also logged; dev code returned
    // only when email delivery is disabled, so we don't leak codes in prod).
    const verificationCode = await this.issueVerificationCode(user.id, user.email);

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user,
      ...tokens,
      emailVerificationRequired: true,
      emailed: this.email.enabled,
      verificationCode: this.email.enabled ? undefined : verificationCode,
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

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

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
