import { Link } from 'src/entities/link.entity';
import { BaseRepositoryAbstract } from './base/base.abstract.repository';
import { LinkRepositoryInterface } from './link.interface.repository';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PopulateOptions } from 'mongoose';
import { UpdateManyDto } from '../types/link';

export class LinkRepository
  extends BaseRepositoryAbstract<Link>
  implements LinkRepositoryInterface
{
  constructor(
    @InjectModel(Link.name)
    private readonly linkModel: Model<Link>,
  ) {
    super(linkModel);
  }
  async findById(id: string): Promise<Link | null> {
    try {
      return await this.linkModel.findById(id).exec();
    } catch (e) {
      return null;
    }
  }

  async findByIdWithSubFields(
    id: string,
    options: {
      populate?: string[] | PopulateOptions | PopulateOptions[];
    },
  ): Promise<Link> {
    const item = await this.linkModel
      .findById(id)
      .populate(options?.populate)
      .exec();
    return item.deleted_at ? null : item;
  }

  async getTotalCondition(condition: any): Promise<any> {
    return this.linkModel.count({ ...condition, deleted_at: null });
  }

  findBySuggestIds(condition: any): Promise<Link[]> {
    try {
      return this.linkModel
        .find({ ...condition, deleted_at: null })
        .lean()
        .exec();
    } catch (e) {
      return null;
    }
  }

  async createMany(data: any): Promise<any> {
    try {
      return await this.linkModel.insertMany(data);
    } catch (e) {
      return null;
    }
  }

  async findAndUpdateByCondition(
    condition?: object,
    data?: UpdateManyDto,
  ): Promise<boolean> {
    try {
      await this.linkModel.updateMany(
        {
          ...condition,
          deleted_at: null,
        },
        data,
      );
      return true;
    } catch (e) {
      return false;
    }
  }
}
