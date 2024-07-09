import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, Length } from 'class-validator';
import { ROLE } from '../../../common/enum';

export class CreateRoleDto {
  @ApiProperty()
  @IsEnum(ROLE)
  @IsNotEmpty()
  code: ROLE;

  @ApiProperty()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @Length(1, 100)
  @IsOptional()
  description: string;
}
