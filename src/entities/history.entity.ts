import { BaseEntity } from './base.entity';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import mongoose from 'mongoose';
import { STATUS_CRON } from '../common/enum';

export type HistoryDocument = HydratedDocument<History>;

@Schema({
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
})
export class History extends BaseEntity {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Link', required: true })
  linkId: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  userId: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  leaderId: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Suggest',
    required: true,
  })
  suggestId: string;

  @Prop({ required: false })
  telegramId?: string;

  @Prop({})
  reason?: string;

  @Prop({
    required: true,
    enum: STATUS_CRON,
    default: STATUS_CRON.PENDING,
  })
  status: string;

  @Prop({
    required: false,
  })
  response?: string;
}

const HistorySchema = SchemaFactory.createForClass(History);

// Create indexes
HistorySchema.index({ status: 1 });
HistorySchema.index({ created_at: -1 });

export { HistorySchema };
