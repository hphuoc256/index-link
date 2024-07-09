import { BaseEntity } from './base.entity';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import mongoose from 'mongoose';
import { WEBSITE_STATUS } from '../common/enum';

export type WebsiteDocument = HydratedDocument<Website>;

@Schema({
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
})
export class Website extends BaseEntity {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  createdBy: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  leaderId: string;

  @Prop({ required: true, minLength: 2, maxLength: 100 })
  domain: string;

  @Prop({
    required: false,
    maxLength: 255,
  })
  description?: string;

  @Prop({
    required: true,
    enum: WEBSITE_STATUS,
    default: WEBSITE_STATUS.ACTIVE,
  })
  status: string;
}

export const WebsiteSchema = SchemaFactory.createForClass(Website);
