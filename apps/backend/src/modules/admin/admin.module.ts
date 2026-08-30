import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { TelegramModule } from '../telegram/telegram.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [JwtModule.register({}), PrismaModule, TelegramModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
