import { IsMongoId, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AuthRefreshTokenDto {
  @ApiProperty()
  @IsString()
  @Length(6, 255)
  refreshToken: string;

  @ApiProperty()
  @IsString()
  @IsMongoId()
  userId: string;
}
