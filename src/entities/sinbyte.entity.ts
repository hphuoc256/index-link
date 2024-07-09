import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BaseEntity } from './base.entity';
import mongoose from 'mongoose';

@Schema({
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
})
export class Sinbyte extends BaseEntity {
  @Prop({
    required: true,
  })
  name: string;

  @Prop({
    required: true,
  })
  apiKey: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  leaderId: string;
}

export const SinByteSchema = SchemaFactory.createForClass(Sinbyte);
