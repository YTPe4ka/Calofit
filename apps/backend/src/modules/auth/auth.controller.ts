import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Get,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'none' as const,
  path: '/',
  maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Public()
  @Throttle({ default: { ttl: 15 * 60 * 1000, limit: 100 } })
  @ApiOperation({ summary: "Ro'yxatdan o'tish" })
  @ApiResponse({ status: 201, description: "Muvaffaqiyatli ro'yxatdan o'tish" })
  @ApiResponse({ status: 409, description: 'Email allaqachon mavjud' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);
    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
    }
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    };
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60 * 1000, limit: 100 } })
  @ApiOperation({ summary: 'Tizimga kirish' })
  @ApiResponse({ status: 200, description: 'Muvaffaqiyatli kirish' })
  @ApiResponse({ status: 401, description: "Noto'g'ri hisob ma'lumotlari" })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
    }
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    };
  }

  @Get('verify-email')
  @Public()
  @ApiOperation({ summary: 'Emailni tasdiqlash' })
  @ApiQuery({ name: 'token', required: true })
  @ApiResponse({ status: 200, description: 'Email tasdiqlandi' })
  @ApiResponse({ status: 401, description: 'Yaroqsiz token' })
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tasdiqlash xatini qayta yuborish' })
  @ApiResponse({ status: 200, description: 'Xat yuborildi' })
  async resendVerification(@Body() body: { email: string; locale?: string }) {
    return this.authService.resendVerification(body.email, body.locale || 'uz');
  }

  @Post('google/callback')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiResponse({ status: 200, description: 'Muvaffaqiyatli kirish' })
  async googleCallback(
    @Body() body: { code: string; redirectUri: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.googleLogin(
      body.code,
      body.redirectUri,
    );
    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
    }
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    };
  }

  @Post('telegram/login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Telegram Web App & Direct Telegram Authentication' })
  @ApiResponse({ status: 200, description: 'Muvaffaqiyatli kirish' })
  async telegramLogin(
    @Body()
    body: {
      initData?: string;
      telegramUser?: any;
      guestId?: string;
      username?: string;
      phone?: string;
      telegramId?: string;
      directUsernameOrPhone?: string;
    },
    @Res({ passthrough: true }) res: Response,
  ) {
    const directVal =
      body.directUsernameOrPhone ||
      body.username ||
      body.phone ||
      body.telegramId;

    const result = await this.authService.telegramLogin(
      body.initData || '',
      body.telegramUser,
      body.guestId,
      directVal,
    );
    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
    }
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Joriy foydalanuvchi ma’lumotlari va obuna holati' })
  @ApiResponse({ status: 200, description: 'Foydalanuvchi ma’lumotlari' })
  async getMe(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Access token yangilash' })
  @ApiResponse({ status: 200, description: 'Yangi access token' })
  @ApiResponse({ status: 401, description: 'Refresh token yaroqsiz' })
  async refresh(
    @Req() req: Request,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      body?.refreshToken ||
      (req.headers['x-refresh-token'] as string) ||
      req.cookies?.['refreshToken'];

    const result = await this.authService.refresh(refreshToken);
    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
    }
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tizimdan chiqish' })
  @ApiResponse({ status: 204, description: 'Muvaffaqiyatli chiqish' })
  async logout(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      body?.refreshToken ||
      (req.headers['x-refresh-token'] as string) ||
      req.cookies?.['refreshToken'];

    await this.authService.logout(userId, refreshToken);
    res.clearCookie('refreshToken', { path: '/' });
  }
}

