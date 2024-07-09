import { BaseRepositoryAbstract } from './base/base.abstract.repository';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Telegram } from 'src/entities/telegram.entity';
import { TelegramRepositoryInterface } from './telegram.interface.repository';

export class TelegramRepository
  extends BaseRepositoryAbstract<Telegram>
  implements TelegramRepositoryInterface
{
  constructor(
    @InjectModel(Telegram.name)
    private readonly telegramModel: Model<Telegram>,
  ) {
    super(telegramModel);
  }

  async findAllCondition(condition?: object): Promise<Telegram[]> {
    try {
      return await this.telegramModel
        .find({ ...condition })
        .lean()
        .exec();
    } catch (e) {
      return [];
    }
  }

  async findAllByCondition(condition?: object): Promise<Telegram[] | any> {
    return this.telegramModel.find({ ...condition });
  }

  async updateMany(condition?: object, set?: object) {
    await this.telegramModel.updateMany({ ...condition }, { $set: { ...set } });
    return true;
  }
}
