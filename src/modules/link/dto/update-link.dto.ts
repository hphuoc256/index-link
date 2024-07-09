import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateLinkDto {
  @ApiProperty({
    example: 'example.com',
  })
  @IsString()
  @IsNotEmpty()
  linkUrl: string;

  @ApiProperty({
    example: '["keyword1", "keyword2"]',
  })
  @IsArray()
  @IsOptional()
  keywords: string[];
}
