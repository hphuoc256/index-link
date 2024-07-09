import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export class CreateLinkDto {
  @ApiProperty({
    example: '656b04e75ff9b618ef2839ee',
  })
  @IsNotEmpty()
  @IsMongoId()
  suggestId: string;

  @ApiProperty({
    example: '["example.com", "example.vn"]',
  })
  @IsArray()
  @IsNotEmpty()
  @ArrayMinSize(1, { message: 'At least one URL must be provided' })
  // @ArrayUnique({ message: 'Duplicate URLs are not allowed' })
  // @IsUrl(
  //   {
  //     require_protocol: true,
  //     protocols: ['http', 'https'],
  //   },
  //   { each: true },
  // )
  linkUrl: string[];

  @ApiProperty({
    example: '["keyword1", "keyword2"]',
  })
  @IsArray()
  @IsOptional()
  keywords: string[];
}
