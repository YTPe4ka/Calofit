import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFeedbackDto {
  @ApiProperty({
    description: 'Feedback or complaint message',
    example: 'App crashes on profile page',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'Optional email for contact',
    example: 'user@example.com',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;
}
