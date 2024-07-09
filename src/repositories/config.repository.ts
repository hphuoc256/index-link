import { BaseRepositoryAbstract } from './base/base.abstract.repository';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PopulateOptions } from 'mongoose';
import { Config } from '../entities/config.entity';
import { ConfigRepositoryInterface } from './config.interface.repository';

export class ConfigRepository
  extends BaseRepositoryAbstract<Config>
  implements ConfigRepositoryInterface
{
  constructor(
    @InjectModel(Config.name)
    private readonly configModel: Model<Config>,
  ) {
    super(configModel);
  }
  async findByIdWithSubFields(
    id: string,
    options: {
      populate?: string[] | PopulateOptions | PopulateOptions[];
    },
  ): Promise<Config> {
    const item = await this.configModel
      .findById(id)
      .populate(options?.populate)
      .exec();
    return item.deleted_at ? null : item;
  }
}
