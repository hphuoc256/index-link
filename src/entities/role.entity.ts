import { BaseEntity } from './base.entity';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ROLE } from '../common/enum';

export type RoleDocument = HydratedDocument<Role>;

@Schema({
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
})
export class Role extends BaseEntity {
  @Prop({
    required: true,
  })
  name: string;

  @Prop({
    required: true,
    unique: true,
    enum: ROLE,
  })
  code: string;

  @Prop({
    required: true,
  })
  description: string;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
