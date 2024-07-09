import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BaseEntity } from './base.entity';
import mongoose from 'mongoose';

@Schema({
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
})
export class Telegram extends BaseEntity {
  @Prop({
    required: true,
  })
  groupName: string;

  @Prop({
    required: true,
  })
  groupId: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  leaderId: string;
}

export const TelegramSchema = SchemaFactory.createForClass(Telegram);
