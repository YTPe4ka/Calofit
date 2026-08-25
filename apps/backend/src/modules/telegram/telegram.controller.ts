import { Controller, Post, Body, Query, Get } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { TelegramService } from './telegram.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('telegram')
@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Public()
  @Post('notify')
  @ApiOperation({
    summary: 'Тестовая отправка уведомления пользователям Telegram',
  })
  @ApiQuery({
    name: 'category',
    enum: ['morning', 'lunch', 'dinner', 'summary'],
    required: false,
  })
  async triggerNotification(
    @Query('category')
    category: 'morning' | 'lunch' | 'dinner' | 'summary' = 'morning',
  ) {
    await this.telegramService.broadcastNotification(category);
    return {
      success: true,
      message: `Notification broadcasted for category: ${category}`,
    };
  }
}
