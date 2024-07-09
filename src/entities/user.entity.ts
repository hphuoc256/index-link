import { BaseEntity } from './base.entity';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ROLE, USER_STATUS } from '../common/enum';
import * as bcrypt from 'bcrypt';
import mongoose from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
})
export class User extends BaseEntity {
  @Prop({
    required: true,
    minlength: 2,
    maxlength: 200,
  })
  name: string;

  @Prop({
    required: true,
    unique: true,
    match: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
  })
  email: string;

  @Prop({
    required: true,
    select: false,
  })
  password: string;

  @Prop({
    required: true,
    enum: USER_STATUS,
    default: USER_STATUS.ACTIVE,
  })
  status: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: false })
  roleId?: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false })
  leaderId?: string;

  @Prop({})
  telegramId?: string;

  @Prop({
    select: false,
  })
  refreshToken?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre('save', async function save(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt();
    if (!/^\$2[abxy]?\$\d+\$/.test(this.password)) {
      this.password = await bcrypt.hash(this.password, salt);
    }
    return next();
  } catch (err) {
    return next(err);
  }
});
UserSchema.pre(['findOneAndUpdate', 'updateOne'], async function save(next) {
  // if (!this.isModified('roleId')) return next();
  try {
    const query: any = this.getQuery();
    const user = this['_update'];
    if (user['role'] === ROLE.USER || user['role'] === ROLE.ADMIN) {
      const usersByLeader = await this.model.find({ leaderId: query['_id'] });
      if (usersByLeader.length) {
        await this.model.updateMany(
          { leaderId: query['_id'] },
          { $set: { leaderId: null } },
        );
      }
    }
    return next();
  } catch (err) {
    return next(err);
  }
});
