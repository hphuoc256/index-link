import { IsMongoId, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateConfigDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsMongoId()
  suggestId?: string;
}
