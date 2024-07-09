import { IsMongoId, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteManySuggestDto {
  @ApiProperty({
    example: ['5f5f2e3b8c7f6d001f6e6a5c', '5f5f2e3b8c7f6d001f6e6a5d'],
  })
  @IsNotEmpty()
  @IsMongoId({ each: true })
  ids: string[];
}
