import { BaseRepositoryAbstract } from './base/base.abstract.repository';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PopulateOptions } from 'mongoose';
import { UserWebsite } from 'src/entities/userwebsite.entity';
import { UserWebsiteRepositoryInterface } from './userwebsite.interface.repository';

export class UserWebsiteRepository
  extends BaseRepositoryAbstract<UserWebsite>
  implements UserWebsiteRepositoryInterface
{
  constructor(
    @InjectModel(UserWebsite.name)
    private readonly userWebsiteModel: Model<UserWebsite>,
  ) {
    super(userWebsiteModel);
  }
  async findById(id: string): Promise<UserWebsite | null> {
    try {
      return await this.userWebsiteModel.findById(id).exec();
    } catch (e) {
      return null;
    }
  }

  async findByIdWithSubFields(
    id: string,
    options: {
      populate?: string[] | PopulateOptions | PopulateOptions[];
    },
  ): Promise<UserWebsite> {
    const item = await this.userWebsiteModel
      .findById(id)
      .populate(options?.populate)
      .exec();
    return item.deleted_at ? null : item;
  }

  async findOneByConditionWithSubField(
    condition = {},
    options: {
      populate?: string[] | PopulateOptions | PopulateOptions[];
    },
  ): Promise<UserWebsite> {
    return await this.userWebsiteModel
      .findOne({
        ...condition,
        deleted_at: null,
      })
      .populate(options?.populate)
      .exec();
  }
  async findAllByCondition(condition?: object): Promise<UserWebsite[] | any> {
    return this.userWebsiteModel.find({ ...condition });
  }
}
