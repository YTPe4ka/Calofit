import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  IsOptional,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: "Email noto'g'ri formatda" })
  @MaxLength(255)
  email: string;

  @ApiProperty({
    example: 'Str0ng!Pass',
    minLength: 8,
    maxLength: 72,
    description: 'Kamida 8 ta belgi, katta/kichik harf va raqam',
  })
  @IsString()
  @MinLength(8, { message: "Parol kamida 8 ta belgi bo'lishi kerak" })
  @MaxLength(72, { message: 'Parol 72 ta belgidan oshmasligi kerak' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: "Parol: katta harf, kichik harf va raqam bo'lishi shart",
  })
  password: string;

  @ApiProperty({ example: 'uz', required: false })
  @IsString()
  @IsOptional()
  locale?: string;
}
