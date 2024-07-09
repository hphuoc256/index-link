import { Prop } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';
import { toNonSpecialChar, toNumber } from '../../utils';

export class QueryDto {
  @IsNumber()
  @Transform(({ value }) => toNumber(value, { default: 1, min: 1 }))
  @IsOptional()
  @Prop({ type: Number, require: true, default: 1 })
  @ApiProperty({ default: 1, required: false, type: Number })
  page: number = 1;

  @IsNumber()
  @Transform(({ value }) => toNumber(value, { default: 10, min: 1 }))
  @ApiProperty({ default: 10, required: false, type: Number })
  @IsOptional()
  @Prop({ type: Number, require: true, default: 10 })
  limit: number = 10;

  @IsOptional()
  @Transform(({ value }) => toNonSpecialChar(value), { toPlainOnly: true })
  @ApiProperty({ default: '', required: false, type: String })
  search: string;

  @Prop({ type: String, default: 'created_at' })
  @IsOptional()
  @ApiProperty({ default: 'created_at', required: false })
  sortBy: string = 'created_at';

  @Prop({ type: String, default: 'DESC' })
  @IsOptional()
  @ApiProperty({ default: 'DESC', required: false })
  order: string = 'DESC';
}
