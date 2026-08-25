import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validationSchema } from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProfileModule } from './modules/profile/profile.module';
import { MealModule } from './modules/meal/meal.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { ChatModule } from './modules/chat/chat.module';
import { MailModule } from './modules/mail/mail.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { AdminModule } from './modules/admin/admin.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
    }),

    // Throttling
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 60,
      },
    ]),

    // Database & Modules
    PrismaModule,
    AuthModule,
    ProfileModule,
    MealModule,
    DashboardModule,
    HealthModule,
    FeedbackModule,
    ChatModule,
    MailModule,
    TelegramModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global Auth Guard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global Throttler Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global Logging Interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
