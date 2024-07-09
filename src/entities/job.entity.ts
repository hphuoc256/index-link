import { BaseEntity } from './base.entity';
import mongoose from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { JOB_STATUS } from '../common/enum';

@Schema({
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
})
export class Job extends BaseEntity {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Link', required: true })
  linkId: string;

  @Prop({ required: true, minLength: 1 })
  linkUrl: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Suggest',
    required: true,
  })
  suggestId: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Config',
    required: false,
  })
  configId?: string;

  @Prop({ required: false })
  type: string;

  @Prop({
    required: true,
    enum: JOB_STATUS,
    default: JOB_STATUS.WAITING,
  })
  status: string;

  @Prop({ required: false })
  numberOfLoop: number;
}

export const JobSchema = SchemaFactory.createForClass(Job);
