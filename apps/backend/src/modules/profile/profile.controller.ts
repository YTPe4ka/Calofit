import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('profile')
@ApiBearerAuth()
@Controller('profile')
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: "Profilni ko'rish" })
  @ApiResponse({ status: 200, description: "Profil ma'lumotlari" })
  @ApiResponse({ status: 404, description: 'Profil topilmadi' })
  getProfile(@CurrentUser('id') userId: string) {
    return this.profileService.findByUserId(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Profil yaratish' })
  @ApiResponse({ status: 201, description: 'Profil yaratildi' })
  @ApiResponse({ status: 409, description: 'Profil allaqachon mavjud' })
  createProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateProfileDto,
  ) {
    return this.profileService.create(userId, dto);
  }

  @Patch()
  @ApiOperation({ summary: 'Profilni yangilash' })
  @ApiResponse({ status: 200, description: 'Profil yangilandi' })
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.update(userId, dto);
  }
}
