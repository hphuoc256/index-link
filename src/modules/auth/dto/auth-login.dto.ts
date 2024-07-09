import { IsEmail, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AuthLoginDto {
  @ApiProperty({
    default: 'user@gmail.com',
  })
  @IsEmail()
  @Length(6, 255)
  email: string;

  @ApiProperty({
    default: '********',
  })
  @Length(6, 100)
  @IsNotEmpty()
  password: string;
}
