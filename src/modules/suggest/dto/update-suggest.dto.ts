import {
  IsNotEmpty,
  IsString,
  Length,
  IsDateString,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSuggestDto {
  @ApiProperty({
    example: 'Name Suggest',
  })
  @Length(2, 100)
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'Link google drive',
  })
  @Length(2, 255)
  @IsString()
  @IsNotEmpty()
  linkSuggest: string;

  @ApiProperty({
    example: 'https://web.telegram.org/a/#6634428545',
  })
  @Length(2, 100)
  @IsOptional()
  telegramId?: string;

  @ApiProperty({
    example: '2023-12-02 10:13:44',
  })
  @IsNotEmpty()
  @IsDateString(
    {},
    { message: 'Date is not in correct format YYYY-MM-DD HH:MM:SS' },
  )
  guaranteed: Date;

  @ApiProperty({
    example: 0,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(30)
  timer: number;
}
