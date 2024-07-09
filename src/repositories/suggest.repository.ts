import { BaseRepositoryAbstract } from './base/base.abstract.repository';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PopulateOptions } from 'mongoose';
import { Suggest } from '../entities/suggest.entity';
import { SuggestRepositoryInterface } from './suggest.interface.repository';

export class SuggestRepository
  extends BaseRepositoryAbstract<Suggest>
  implements SuggestRepositoryInterface
{
  constructor(
    @InjectModel(Suggest.name)
    private readonly suggestModel: Model<Suggest>,
  ) {
    super(suggestModel);
  }
  async findById(id: string): Promise<Suggest | null> {
    try {
      return await this.suggestModel.findById({ _id: id }).exec();
    } catch (e) {
      return null;
    }
  }
  async findByIdWithSubFields(
    id: string,
    options: {
      populate?: string[] | PopulateOptions | PopulateOptions[];
    },
  ): Promise<Suggest> {
    const item = await this.suggestModel
      .findById(id)
      .populate(options?.populate)
      .exec();
    return item.deleted_at ? null : item;
  }

  async getSuggestCondition(condition: any): Promise<any> {
    return this.suggestModel.find({ ...condition, deleted_at: null });
  }

  async findAllByCondition(condition?: object): Promise<Suggest[] | any> {
    return this.suggestModel.find({ ...condition, deleted_at: null });
  }
}
