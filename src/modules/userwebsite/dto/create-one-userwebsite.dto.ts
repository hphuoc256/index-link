import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty } from 'class-validator';

export class CreateOneUserWebsiteDto {
  @ApiProperty()
  @IsNotEmpty()
  websiteId: string;

  @ApiProperty()
  @IsNotEmpty()
  userId: string;

  @ApiProperty()
  @IsNotEmpty()
  leaderId: string;
}
