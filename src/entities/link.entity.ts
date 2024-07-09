import { BaseEntity } from './base.entity';
import mongoose from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { FOLLOW_LINK, INDEX_LINK, STATUS_LINK } from '../common/enum';

@Schema({
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
})
export class Link extends BaseEntity {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Suggest',
    required: true,
  })
  suggestId: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  userId: string;

  @Prop({ required: true })
  linkUrl: string;

  @Prop({
    required: false,
    enum: STATUS_LINK,
    default: STATUS_LINK.WAITING,
  })
  status: string;

  @Prop({
    required: false,
    enum: INDEX_LINK,
    default: INDEX_LINK.WAITING,
  })
  isIndex: string;

  @Prop({
    required: false,
    enum: FOLLOW_LINK,
    default: FOLLOW_LINK.WAITING,
  })
  isFollow: string;

  @Prop({
    required: false,
    enum: INDEX_LINK,
    default: INDEX_LINK.WAITING,
  })
  indexed: string;

  @Prop({
    required: false,
    default: false,
  })
  isChecked: boolean;

  @Prop({ required: false })
  keywords: string[];
}

export const LinkSchema = SchemaFactory.createForClass(Link);
