import { Prop } from '@nestjs/mongoose';

export class BaseEntity {
  _id?: string; // use with class-transformer for serialize response data

  @Prop({ default: null })
  deleted_at: Date; //  soft delete
}
