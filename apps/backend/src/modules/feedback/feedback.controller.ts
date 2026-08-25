import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackService } from './feedback.service';
import type { Request } from 'express';

@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @Public()
  @ApiOperation({ summary: 'Shikoyat yoki fikr-mulohaza yuborish' })
  @ApiResponse({
    status: 201,
    description: 'Muvaffaqiyatli saqlandi va Telegramga yuborildi',
  })
  async submitFeedback(@Body() dto: CreateFeedbackDto, @Req() req: Request) {
    // optional extraction of userId if user is logged in
    const userId = (req as any).user?.id;
    return this.feedbackService.create(dto, userId);
  }
}
