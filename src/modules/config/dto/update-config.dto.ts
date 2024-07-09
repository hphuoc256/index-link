import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateConfigDto {
  @ApiProperty()
  @Length(2, 100)
  @IsString()
  @IsNotEmpty()
  name: string;

  /*@ApiProperty()
  @Max(100)
  @IsNumber()
  @IsNotEmpty()
  threshold: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  date: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString(
    {},
    { message: 'Date is not in correct format YYYY-MM-DD HH:MM:SS' },
  )
  startDate: Date;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString(
    {},
    { message: 'Date is not in correct format YYYY-MM-DD HH:MM:SS' },
  )
  endDate: Date;

  @ApiProperty()
  @IsOptional()
  @IsEnum(STATUS_CONFIG)
  status: STATUS_CONFIG;*/
}
