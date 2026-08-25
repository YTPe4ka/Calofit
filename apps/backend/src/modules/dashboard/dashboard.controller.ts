import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: "Bugungi dashboard ma'lumotlari" })
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  getDashboard(@CurrentUser('id') userId: string) {
    return this.dashboardService.getDashboard(userId);
  }
}
