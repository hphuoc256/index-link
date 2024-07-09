import { IsMongoId, IsOptional, Length } from 'class-validator';
import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['email'] as const),
) {
  @ApiProperty()
  @Length(1, 200)
  @IsOptional()
  name?: string;

  @ApiProperty()
  @IsOptional()
  @Length(6, 100)
  password?: string;

  @ApiProperty()
  @IsOptional()
  role?: string;

  @ApiProperty()
  @IsOptional()
  @IsMongoId()
  leaderId?: string;

  @ApiProperty()
  @IsOptional()
  telegramId?: string;
}
