import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class LinkItemDto {
  @ApiProperty({
    description: 'URL of the link',
    example: 'https://example.com',
  })
  @IsNotEmpty()
  @IsString()
  @IsUrl({ require_protocol: true })
  linkUrl: string;

  @ApiProperty({
    description: 'anchor text of the link',
    example: 'example',
  })
  @IsNotEmpty()
  @IsString()
  anchorText: string;
}
