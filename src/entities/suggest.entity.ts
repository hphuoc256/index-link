import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { BaseEntity } from './base.entity';

export type SuggestDocument = HydratedDocument<Suggest>;
@Schema({
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
})
export class Suggest extends BaseEntity {
  @Prop({ required: true, minLength: 2, maxLength: 100 })
  name: string;

  @Prop({ required: true, minLength: 2, maxLength: 255 })
  linkSuggest: string;

  @Prop({ minLength: 2, maxLength: 100 })
  telegramId?: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  userId: string;

  @Prop({ default: null })
  guaranteed: Date;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Website',
    required: true,
  })
  websiteId: string;

  @Prop({ type: Number, required: false, default: 0 })
  totalMoney: number;

  @Prop({
    required: false,
    default: false,
  })
  isChecked: boolean;

  @Prop({ type: Number, required: false, default: 10 })
  timer: number;
}
export const SuggestSchema = SchemaFactory.createForClass(Suggest);
