import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty } from 'class-validator';

export class CreateUserWebsiteDto {
  @ApiProperty()
  @IsNotEmpty()
  websiteId: string;

  @ApiProperty()
  @IsArray()
  @IsNotEmpty()
  userId: string[];

  @ApiProperty()
  @IsNotEmpty()
  leaderId: string;
}
