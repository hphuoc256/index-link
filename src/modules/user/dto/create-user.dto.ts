import {
  IsEmail,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  Length,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty()
  @Length(1, 200)
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  @Length(3, 200)
  email: string;

  @ApiProperty()
  @Length(6, 100)
  @IsNotEmpty()
  password: string;

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
