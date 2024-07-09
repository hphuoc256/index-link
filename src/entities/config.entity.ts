import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BaseEntity } from './base.entity';
import mongoose from 'mongoose';
import { STATUS_CONFIG, TYPE_CONFIG } from '../common/enum';

@Schema({
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
})
export class Config extends BaseEntity {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Suggest',
    required: true,
  })
  suggestId: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  userId: string;

  @Prop({
    required: true,
    enum: STATUS_CONFIG,
    default: STATUS_CONFIG.WAITING,
  })
  status: string;

  @Prop({
    required: true,
    enum: TYPE_CONFIG,
    default: TYPE_CONFIG.NORMAL,
  })
  type: string;
}

export const ConfigSchema = SchemaFactory.createForClass(Config);
