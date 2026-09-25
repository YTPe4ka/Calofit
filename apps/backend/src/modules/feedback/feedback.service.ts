import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  // Telegram configurations directly from request
  private readonly botToken = '8941389947:AAH2nwLGCuJMbRynEVSz7PyOOO5bXg_XKlU';
  private readonly chatId = '7162831196';

  constructor(private prisma: PrismaService) {}

  async create(dto: CreateFeedbackDto, userId?: string) {
    // 1. Save to Database
    const feedback = await this.prisma.feedback.create({
      data: {
        userId,
        email: dto.email,
        message: dto.message,
      },
    });

    // 2. Dispatch to Telegram Bot
    try {
      const escapedMessage = dto.message
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const telegramText =
        `🚨 <b>YANGI SHIKOYAT / FIKR-MULOHAZA</b>\n\n` +
        `👤 <b>Foydalanuvchi:</b> ${userId ? `<code>${userId}</code>` : 'Anonim'}\n` +
        `📧 <b>Aloqa:</b> ${dto.email ? `<code>${dto.email}</code>` : 'Kiritilmagan'}\n\n` +
        `💬 <b>Xabar:</b>\n${escapedMessage}`;

      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.chatId,
            text: telegramText,
            parse_mode: 'HTML',
          }),
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error(
          `Telegram API error: ${response.status} - ${errText}`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to forward feedback to Telegram bot', error);
    }

    return feedback;
  }
}
