import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { MealService } from './meal.service';
import { ConfirmMealDto } from './dto/confirm-meal.dto';
import { ProfileGuard } from '../../common/guards/profile.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

@ApiTags('meals')
@ApiBearerAuth()
@Controller('meals')
export class MealController {
  constructor(private mealService: MealService) {}

  @Post('analyze')
  @UseGuards(ProfileGuard)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SIZE },
      fileFilter: (_, file, cb) => {
        if (!ALLOWED_MIME.includes(file.mimetype)) {
          return cb(
            new Error('UNSUPPORTED_MEDIA_TYPE: Faqat JPEG, PNG, WEBP'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Ovqat rasmini AI orqali tahlil qilish' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'JPEG/PNG/WEBP, max 10MB',
        },
      },
      required: ['image'],
    },
  })
  @ApiResponse({ status: 201, description: 'Tahlil natijasi' })
  @ApiResponse({ status: 403, description: "Profil to'ldirilmagan" })
  @ApiResponse({ status: 413, description: 'Fayl 10MB dan katta' })
  @ApiResponse({ status: 422, description: 'Rasmda ovqat aniqlanmadi' })
  @ApiResponse({ status: 503, description: 'AI xizmat ishlamayapti' })
  async analyze(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('locale') locale?: string,
  ) {
    if (!file) {
      return { error: 'BAD_REQUEST', message: 'Rasm fayli yuklanmadi' };
    }
    return this.mealService.analyze(userId, file, locale);
  }

  @Post('confirm')
  @ApiOperation({ summary: 'AI tahlilini tasdiqlash va log ga saqlash' })
  @ApiResponse({ status: 201, description: 'Meal log saqlandi' })
  @ApiResponse({ status: 404, description: 'Tahlil topilmadi' })
  @ApiResponse({ status: 409, description: 'Allaqachon tasdiqlangan' })
  confirm(@CurrentUser('id') userId: string, @Body() dto: ConfirmMealDto) {
    return this.mealService.confirm(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Kunlik ovqat loglari' })
  @ApiQuery({
    name: 'date',
    required: false,
    example: '2026-07-08',
    description: 'YYYY-MM-DD',
  })
  @ApiResponse({ status: 200, description: 'Kunlik loglar va summary' })
  getDailyLogs(
    @CurrentUser('id') userId: string,
    @Query('date') date?: string,
  ) {
    return this.mealService.getDailyLogs(userId, date);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Meal logni o'chirish" })
  @ApiResponse({ status: 204, description: "Muvaffaqiyatli o'chirildi" })
  @ApiResponse({ status: 404, description: 'Log topilmadi' })
  @ApiResponse({ status: 403, description: "Ruxsat yo'q" })
  deleteLog(@CurrentUser('id') userId: string, @Param('id') logId: string) {
    return this.mealService.deleteLog(userId, logId);
  }
}
