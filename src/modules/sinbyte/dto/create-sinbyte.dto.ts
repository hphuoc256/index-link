import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, Length } from 'class-validator';

export class CreateSinbyteDto {
  @IsNotEmpty()
  @Length(1, 200)
  @ApiProperty({
    example: 'Team 11',
  })
  name: string;

  @IsNotEmpty()
  @Length(1, 200)
  @ApiProperty({
    example: 'pp74xezyqu6gxjn1bzj0udygiompcb0titotlwu77',
  })
  apiKey: string;

  @ApiProperty({
    example: '656b04e75ff9b618ef2839ee',
  })
  @IsOptional()
  @IsMongoId()
  leaderId: string;
}
