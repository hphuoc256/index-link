import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Match } from './auth-register.dto';

export class AuthChangePassDto {
  @ApiProperty()
  @Length(6, 100)
  @IsNotEmpty()
  @IsString()
  oldPassword: string;

  @ApiProperty()
  @Length(6, 100)
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty()
  @Length(6, 100)
  @IsNotEmpty()
  @IsString()
  @Match('password', {
    message: 'confirmPassword must match password',
  })
  confirmPassword: string;
}
