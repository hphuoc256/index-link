import { USER_STATUS, WEBSITE_STATUS } from '../../../common/enum';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Prop, Schema } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { QueryDto } from '../../../common/dto/query.dto';
import { IsEnum, IsOptional } from 'class-validator';

export interface FilterInterface {
  userId?: Types.ObjectId;
  sort?: 'ASC' | 'DESC';
  orderBy?: string;
  search?: string;
  page?: number;
  limit?: number;
  skip?: number;
  status?: USER_STATUS;
}

@Schema()
export class QueryWebsiteDto extends PartialType(QueryDto) {
  @Prop()
  @IsOptional()
  @IsEnum(WEBSITE_STATUS)
  @ApiProperty({ required: false, enum: WEBSITE_STATUS })
  status?: string;
}
