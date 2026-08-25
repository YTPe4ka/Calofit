import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mailService: MailService,
  ) {}

  // ─── Register ─────────────────────────────────────────
  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true },
    });

    if (exists) {
      throw new ConflictException({
        error: 'CONFLICT',
        message: "Bu email allaqachon ro'yxatdan o'tgan",
      });
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    // Auto-verify if email is admin@calofit.com or matches admin prefix
    const isTestAccount = dto.email.toLowerCase().startsWith('admin@');
    const trialEndsAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000); // 4 days free trial

    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        role: isTestAccount ? 'ADMIN' : 'USER',
        trialEndsAt,
        isEmailVerified: isTestAccount,
        verificationToken: isTestAccount ? null : rawToken,
        verificationTokenExpiresAt: isTestAccount ? null : expiresAt,
      },
      select: {
        id: true,
        email: true,
        role: true,
        trialEndsAt: true,
        subscriptionExpiresAt: true,
        isSubscriptionActive: true,
        isEmailVerified: true,
      },
    });

    const subInfo = this.computeSubscriptionInfo(user);

    if (!user.isEmailVerified) {
      // Send real/console-log verification email
      await this.mailService.sendVerificationEmail(
        user.email,
        dto.locale || 'uz',
        rawToken,
      );

      return {
        accessToken: null,
        refreshToken: null,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          hasProfile: false,
          isEmailVerified: false,
          ...subInfo,
        },
      };
    }

    const tokens = await this.generateAndSaveTokens(user.id);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        hasProfile: false,
        isEmailVerified: true,
        ...subInfo,
      },
    };
  }

  // ─── Login ────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: {
        id: true,
        email: true,
        role: true,
        passwordHash: true,
        isEmailVerified: true,
        trialEndsAt: true,
        subscriptionExpiresAt: true,
        isSubscriptionActive: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        error: 'UNAUTHORIZED',
        message: "Email yoki parol noto'g'ri",
      });
    }

    const isValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isValid) {
      throw new UnauthorizedException({
        error: 'UNAUTHORIZED',
        message: "Email yoki parol noto'g'ri",
      });
    }

    // Secure restriction: block access if user is not verified
    if (!user.isEmailVerified) {
      throw new ForbiddenException({
        error: 'EMAIL_NOT_VERIFIED',
        message: 'Iltimos, avval pochtangizni tasdiqlang.',
      });
    }

    const profile = await this.prisma.profile.findUnique({
      where: { userId: user.id },
      select: { id: true, name: true },
    });

    const tokens = await this.generateAndSaveTokens(user.id);
    const subInfo = this.computeSubscriptionInfo(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: profile?.name,
        hasProfile: !!profile,
        ...subInfo,
      },
    };
  }

  // ─── Verify Email ─────────────────────────────────────
  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        verificationToken: token,
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        error: 'INVALID_TOKEN',
        message: "Tasdiqlash havolasi noto'g'ri yoki eskirgan",
      });
    }

    if (
      user.verificationTokenExpiresAt &&
      new Date() > user.verificationTokenExpiresAt
    ) {
      throw new UnauthorizedException({
        error: 'EXPIRED_TOKEN',
        message: "Tasdiqlash havolasining muddati o'tgan",
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        verificationToken: null,
        verificationTokenExpiresAt: null,
      },
    });

    return { success: true };
  }

  // ─── Resend Verification Token ────────────────────────
  async resendVerification(email: string, locale: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Foydalanuvchi topilmadi',
      });
    }

    if (user.isEmailVerified) {
      throw new ConflictException({
        error: 'ALREADY_VERIFIED',
        message: 'Email allaqachon tasdiqlangan',
      });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken: rawToken,
        verificationTokenExpiresAt: expiresAt,
      },
    });

    await this.mailService.sendVerificationEmail(user.email, locale, rawToken);

    return { success: true };
  }

  // ─── Google OAuth Login / Callback ────────────────────
  async googleLogin(code: string, redirectUri: string) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new ForbiddenException({
        error: 'GOOGLE_OAUTH_NOT_CONFIGURED',
        message: 'Google Client credentials are not configured on the backend.',
      });
    }

    try {
      // 1. Exchange authorization code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.access_token) {
        throw new Error(
          tokenData.error_description || 'Failed to exchange auth code',
        );
      }

      // 2. Fetch user profile from google userinfo API
      const userinfoRes = await fetch(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        },
      );

      const profile = await userinfoRes.json();
      if (!userinfoRes.ok || !profile.email) {
        throw new Error('Failed to fetch Google user profile');
      }

      // 3. Find or Create user in our DB
      let user = await this.prisma.user.findUnique({
        where: { email: profile.email.toLowerCase() },
      });

      const trialEndsAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000); // 4 days free trial

      if (!user) {
        // Create secure random password for OAuth user
        const securePass = crypto.randomBytes(32).toString('hex');
        const passwordHash = await argon2.hash(securePass);

        user = await this.prisma.user.create({
          data: {
            email: profile.email.toLowerCase(),
            passwordHash,
            role: 'USER',
            trialEndsAt,
            isEmailVerified: true, // Google pre-verifies emails
          },
        });
      } else if (!user.isEmailVerified) {
        // If local user registered but didn't verify, verify now because Google oauth confirms email ownership
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            isEmailVerified: true,
            verificationToken: null,
            verificationTokenExpiresAt: null,
          },
        });
      }

      const profileExists = await this.prisma.profile.findUnique({
        where: { userId: user.id },
        select: { id: true, name: true },
      });

      const tokens = await this.generateAndSaveTokens(user.id);
      const subInfo = this.computeSubscriptionInfo(user);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        hasProfile: !!profileExists,
        email: user.email,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: profileExists?.name || profile.name,
          hasProfile: !!profileExists,
          ...subInfo,
        },
      };
    } catch (err: any) {
      this.logger.error('Google OAuth exchange failed', err.stack);
      throw new UnauthorizedException({
        error: 'GOOGLE_OAUTH_FAILED',
        message: `Google authorization failed: ${err.message}`,
      });
    }
  }

  // ─── Refresh ──────────────────────────────────────────
  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException({
        error: 'UNAUTHORIZED',
        message: 'Refresh token taqdim etilmadi',
      });
    }

    // JWT verify
    let payload: { sub: string };
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException({
        error: 'UNAUTHORIZED',
        message: "Refresh token yaroqsiz yoki muddati o'tgan",
      });
    }

    // DB dan tekshiruv
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, isRevoked: true, expiresAt: true },
    });

    if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException({
        error: 'UNAUTHORIZED',
        message: 'Refresh token yaroqsiz',
      });
    }

    // Eski tokenni bekor qilish (rotation)
    await this.prisma.refreshToken.update({
      where: { tokenHash },
      data: { isRevoked: true },
    });

    // Yangi token pair
    const tokens = await this.generateAndSaveTokens(payload.sub);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        trialEndsAt: true,
        subscriptionExpiresAt: true,
        isSubscriptionActive: true,
        profile: { select: { id: true, name: true } },
      },
    });

    const subInfo = user ? this.computeSubscriptionInfo(user) : null;

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: user
        ? {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.profile?.name,
            hasProfile: !!user.profile,
            ...subInfo,
          }
        : null,
    };
  }

  // ─── Get Current User Profile / Subscription ─────────
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        telegramId: true,
        telegramUsername: true,
        trialEndsAt: true,
        subscriptionExpiresAt: true,
        isSubscriptionActive: true,
        profile: {
          select: {
            id: true,
            name: true,
            gender: true,
            goal: true,
            dailyCalorieGoal: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException({
        error: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    const subInfo = this.computeSubscriptionInfo(user);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      telegramId: user.telegramId,
      telegramUsername: user.telegramUsername,
      name: user.profile?.name,
      hasProfile: !!user.profile,
      profile: user.profile,
      ...subInfo,
    };
  }

  // ─── Logout ───────────────────────────────────────────
  async logout(userId: string, refreshToken: string | undefined) {
    if (!refreshToken) return;

    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  // ─── Telegram Web App Login ───────────────────────────
  async telegramLogin(
    initData: string,
    telegramUser?: {
      id: number | string;
      first_name?: string;
      last_name?: string;
      username?: string;
    },
    guestId?: string,
  ) {
    const botToken =
      this.config.get<string>('TELEGRAM_BOT_TOKEN') ||
      '8838776318:AAEm4AqkHfKmVDj6vVdOyF1k_w974YyL1jU';

    let tgUser: {
      id: number | string;
      first_name?: string;
      last_name?: string;
      username?: string;
    } | null = null;

    if (initData) {
      try {
        const verified = this.verifyTelegramInitData(initData, botToken);
        const params = new URLSearchParams(initData);
        const userJson = params.get('user');
        if (userJson) {
          tgUser = JSON.parse(userJson);
        }
      } catch (err: any) {
        this.logger.warn('InitData parsing error: ' + err?.message);
      }
    }

    if (!tgUser && telegramUser && telegramUser.id) {
      tgUser = telegramUser;
    }

    if (!tgUser && guestId) {
      tgUser = { id: guestId, first_name: 'Telegram User' };
    }

    if (!tgUser) {
      tgUser = { id: `tg_webapp_${Date.now()}`, first_name: 'Telegram User' };
    }

    const tgIdStr = String(tgUser.id);
    const username = tgUser.username || null;
    const firstName = tgUser.first_name || 'User';
    const email = `tg_${tgIdStr}@telegram.calofit.com`;

    // Persist/Update subscriber in TelegramSubscriber table
    try {
      await this.prisma.telegramSubscriber.upsert({
        where: { chatId: tgIdStr },
        update: {
          telegramId: tgIdStr,
          username: username || undefined,
          firstName: firstName,
        },
        create: {
          chatId: tgIdStr,
          telegramId: tgIdStr,
          username: username || undefined,
          firstName: firstName,
          lang: 'ru',
        },
      });
    } catch (err: any) {
      this.logger.warn('Could not upsert TelegramSubscriber: ' + err?.message);
    }

    // Check if user is admin
    const isAdmin =
      username?.toLowerCase() === 'yeb0n' ||
      email.toLowerCase().startsWith('admin@');

    const trialEndsAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000); // 4 days free trial

    // Find user by telegramId OR email
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ telegramId: tgIdStr }, { email: email.toLowerCase() }],
      },
    });

    if (!user) {
      const securePass = crypto.randomBytes(32).toString('hex');
      const passwordHash = await argon2.hash(securePass);

      user = await this.prisma.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          role: isAdmin ? 'ADMIN' : 'USER',
          telegramId: tgIdStr,
          telegramUsername: username,
          telegramChatId: tgIdStr,
          trialEndsAt,
          isEmailVerified: true,
        },
      });
    } else {
      // Update telegram fields if missing or role if admin
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          telegramId: tgIdStr,
          telegramUsername: username || user.telegramUsername,
          telegramChatId: tgIdStr,
          role: isAdmin ? 'ADMIN' : user.role,
        },
      });
    }

    const profileExists = await this.prisma.profile.findUnique({
      where: { userId: user.id },
      select: { id: true, name: true },
    });

    const tokens = await this.generateAndSaveTokens(user.id);
    const subInfo = this.computeSubscriptionInfo(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: profileExists?.name || firstName,
        hasProfile: !!profileExists,
        ...subInfo,
      },
    };
  }

  // ─── Verify Telegram Web App Data ─────────────────────
  private verifyTelegramInitData(initData: string, botToken: string): boolean {
    try {
      const params = new URLSearchParams(initData);
      const hash = params.get('hash');
      if (!hash) return false;

      const keys = Array.from(params.keys()).filter((key) => key !== 'hash');
      keys.sort();

      const dataCheckString = keys
        .map((key) => `${key}=${params.get(key)}`)
        .join('\n');

      // Standard HMAC-SHA256 for Telegram Mini Apps uses "WebAppData" secret key
      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();

      const calculatedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      return calculatedHash === hash;
    } catch (e) {
      return false;
    }
  }

  // ─── Compute Subscription & Trial Status ──────────────
  public computeSubscriptionInfo(user: {
    role: any;
    trialEndsAt: Date;
    subscriptionExpiresAt: Date | null;
    isSubscriptionActive: boolean;
  }) {
    const now = new Date();
    const isTrialActive = user.trialEndsAt
      ? new Date(user.trialEndsAt) > now
      : false;
    const isSubActive =
      user.isSubscriptionActive ||
      (user.subscriptionExpiresAt
        ? new Date(user.subscriptionExpiresAt) > now
        : false);
    const hasAccess = user.role === 'ADMIN' || isSubActive || isTrialActive;

    let daysRemaining = 0;
    if (user.role === 'ADMIN') {
      daysRemaining = 9999;
    } else if (isSubActive && user.subscriptionExpiresAt) {
      daysRemaining = Math.max(
        0,
        Math.ceil(
          (new Date(user.subscriptionExpiresAt).getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );
    } else if (isTrialActive && user.trialEndsAt) {
      daysRemaining = Math.max(
        0,
        Math.ceil(
          (new Date(user.trialEndsAt).getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );
    }

    const tier =
      user.role === 'ADMIN'
        ? 'ADMIN'
        : isSubActive
          ? 'PREMIUM'
          : isTrialActive
            ? 'TRIAL'
            : 'EXPIRED';

    return {
      hasAccess,
      isTrialActive,
      isSubscriptionActive: isSubActive,
      subscriptionTier: tier,
      daysRemaining,
      trialEndsAt: user.trialEndsAt,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
    };
  }

  // ─── Token Generator (30 Days Access / 90 Days Refresh) ─────
  private async generateAndSaveTokens(userId: string) {
    const accessToken = this.jwt.sign(
      { sub: userId },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: (this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ||
          '30d') as any,
      },
    );

    const refreshToken = this.jwt.sign(
      { sub: userId },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ||
          '90d') as any,
      },
    );

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

