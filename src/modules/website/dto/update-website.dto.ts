import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
} from 'class-validator';

export class UpdateWebsiteDto {
  @ApiProperty({
    example: 'https://example.com',
  })
  @Length(1, 100)
  @IsString()
  @IsNotEmpty()
  @IsUrl({
    require_protocol: true,
    protocols: ['http', 'https'],
  })
  domain: string;

  @ApiProperty({
    example: 'Ok Vip description',
  })
  @IsOptional()
  description: string;

  @ApiProperty({
    example: '["655b641b83b632c9ab1f525c", "655b641f83b632c9ab1f5269"]',
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  @IsString({ each: true })
  userIdAddLinks: string[];

  @ApiProperty({
    example: '655b640d83b632c9ab1f5251',
  })
  @IsOptional()
  @IsMongoId()
  leaderId?: string;
}
