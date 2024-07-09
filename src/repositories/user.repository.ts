import { BaseRepositoryAbstract } from './base/base.abstract.repository';
import { User } from '../entities/user.entity';
import { UserRepositoryInterface } from './user.interface.repository';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PopulateOptions } from 'mongoose';

export class UserRepository
  extends BaseRepositoryAbstract<User>
  implements UserRepositoryInterface
{
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {
    super(userModel);
  }
  async find(query: any): Promise<User[]> {
    return await this.userModel.find(query).exec();
  }

  async findByEmail(
    email,
    isPassword = false,
  ): Promise<User | undefined | any> {
    if (!isPassword) {
      return await this.userModel
        .findOne({ email, deleted_at: null })
        .populate('roleId')
        .populate('leaderId', 'name email')
        .exec();
    }
    return await this.userModel
      .findOne({ email, deleted_at: null })
      .select('+password')
      .lean()
      .exec();
  }

  async updateRefreshToken({ id, refreshToken }): Promise<User> {
    return this.userModel.findOneAndUpdate(
      { _id: id, deleted_at: null },
      { id, refreshToken },
      {
        new: true,
      },
    );
  }

  async findWithPasswordById({ id }): Promise<User | undefined | any> {
    return await this.userModel
      .findOne({ _id: id, deleted_at: null })
      .select('+password')
      .lean()
      .exec();
  }

  async findByIdWithSubFields(
    id: string,
    options: {
      populate?: string[] | PopulateOptions | PopulateOptions[];
    },
  ): Promise<User> {
    const item = await this.userModel
      .findById(id)
      .populate(options?.populate)
      .exec();
    return item?.deleted_at ? null : item;
  }

  async findOneWithRefreshToken(id: string): Promise<User> {
    return await this.userModel
      .findOne({ _id: id, deleted_at: null })
      .select('+refreshToken')
      .exec();
  }
}
