import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, Length } from 'class-validator';

export class TelegramConfigCreateDto {
  @IsNotEmpty()
  @Length(1, 200)
  @ApiProperty({
    example: 'Team 11',
  })
  groupName: string;

  @IsNotEmpty()
  @Length(1, 200)
  @ApiProperty({
    example: '-1002003528677',
  })
  groupId: string;

  @ApiProperty({
    example: '656b04e75ff9b618ef2839ee',
  })
  @IsOptional()
  @IsMongoId()
  leaderId: string;
}
