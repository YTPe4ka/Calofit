import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum ChatRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export class ChatMessageDto {
  @ApiProperty({ enum: ChatRole, example: 'user' })
  @IsEnum(ChatRole)
  role: ChatRole;

  @ApiProperty({ example: 'Hello, how can I lose 5kg?' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class SendMessageDto {
  @ApiProperty({
    description: 'The new message from the user',
    example: 'What should I eat for breakfast?',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'Conversation history for context',
    type: [ChatMessageDto],
    required: false,
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  history?: ChatMessageDto[];
}
