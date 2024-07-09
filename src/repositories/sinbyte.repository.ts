import { BaseRepositoryAbstract } from './base/base.abstract.repository';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SinbyteRepositoryInterface } from './sinbyte.interface.repository';
import { Sinbyte } from '../entities/sinbyte.entity';

export class SinbyteRepository
  extends BaseRepositoryAbstract<Sinbyte>
  implements SinbyteRepositoryInterface
{
  constructor(
    @InjectModel(Sinbyte.name)
    private readonly sinbyteModel: Model<Sinbyte>,
  ) {
    super(sinbyteModel);
  }

  async findAllCondition(condition?: object): Promise<Sinbyte[]> {
    try {
      return await this.sinbyteModel
        .find({ ...condition })
        .lean()
        .exec();
    } catch (e) {
      return [];
    }
  }

  async findAllByCondition(condition?: object): Promise<Sinbyte[] | any> {
    return this.sinbyteModel.find({ ...condition });
  }

  async updateMany(condition?: object, set?: object) {
    await this.sinbyteModel.updateMany({ ...condition }, { $set: { ...set } });
    return true;
  }
}
