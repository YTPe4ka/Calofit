import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  ForbiddenException,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  private verifyAdminAccess(
    currentUser: any,
    adminKeyHeader?: string,
  ) {
    const validSecret = process.env.ADMIN_SECRET || 'yeb0n_admin_pass';
    if (adminKeyHeader && adminKeyHeader === validSecret) {
      return true;
    }
    if (
      currentUser &&
      (currentUser.role === 'ADMIN' ||
        currentUser.email?.toLowerCase()?.startsWith('admin@'))
    ) {
      return true;
    }
    throw new ForbiddenException({
      error: 'ADMIN_ACCESS_DENIED',
      message: 'Faqat administratorlar uchun ruxsat berilgan.',
    });
  }

  @Get('stats')
  @Public()
  @ApiOperation({ summary: 'Admin statistikasi' })
  @ApiHeader({ name: 'x-admin-key', required: false })
  async getStats(
    @CurrentUser() user: any,
    @Headers('x-admin-key') adminKey?: string,
  ) {
    this.verifyAdminAccess(user, adminKey);
    return this.adminService.getStats();
  }

  @Get('users')
  @Public()
  @ApiOperation({ summary: 'Foydalanuvchilar ro‘yxati' })
  @ApiHeader({ name: 'x-admin-key', required: false })
  async getUsers(
    @CurrentUser() user: any,
    @Headers('x-admin-key') adminKey?: string,
    @Query('query') query?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.verifyAdminAccess(user, adminKey);
    const p = parseInt(page || '1', 10);
    const l = parseInt(limit || '50', 10);
    return this.adminService.getUsers(query, p, l);
  }

  @Post('users/:userId/subscription')
  @Public()
  @ApiOperation({ summary: 'Obuna holatini yangilash' })
  @ApiHeader({ name: 'x-admin-key', required: false })
  async updateSubscription(
    @Param('userId') userId: string,
    @CurrentUser() user: any,
    @Headers('x-admin-key') adminKey?: string,
    @Body()
    body?: {
      days?: number;
      trialDays?: number;
      isLifetime?: boolean;
      deactivate?: boolean;
      role?: 'USER' | 'ADMIN';
    },
  ) {
    this.verifyAdminAccess(user, adminKey);
    return this.adminService.updateSubscription(userId, body || {});
  }

  @Post('broadcast')
  @Public()
  @ApiOperation({ summary: 'Telegram botga xabar yuborish' })
  @ApiHeader({ name: 'x-admin-key', required: false })
  async broadcast(
    @CurrentUser() user: any,
    @Headers('x-admin-key') adminKey?: string,
    @Body()
    body?: {
      category?: 'morning' | 'lunch' | 'dinner' | 'summary' | 'custom';
      customText?: string;
      targetChatId?: string;
    },
  ) {
    this.verifyAdminAccess(user, adminKey);
    return this.adminService.broadcastNotification(body || {});
  }
}
