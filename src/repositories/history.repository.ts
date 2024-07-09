import { BaseRepositoryAbstract } from './base/base.abstract.repository';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, PopulateOptions } from 'mongoose';
import { HistoryRepositoryInterface } from './history.interface.repository';
import { History } from 'src/entities/history.entity';
import { toNumber } from 'lodash';

export class HistoryRepository
  extends BaseRepositoryAbstract<History>
  implements HistoryRepositoryInterface
{
  constructor(
    @InjectModel(History.name)
    private readonly historyModel: Model<History>,
  ) {
    super(historyModel);
  }

  async findByIdWithSubFields(
    id: string,
    options: {
      populate?: string[] | PopulateOptions | PopulateOptions[];
    },
  ): Promise<History> {
    const item = await this.historyModel
      .findById(id)
      .populate(options?.populate)
      .exec();
    return item.deleted_at ? null : item;
  }

  async findAllWithPagination(condition: any): Promise<any> {
    const matchStage: any = {
      deleted_at: null,
    };

    if (condition?.status) {
      matchStage.status = condition.status;
    }

    if (condition?.suggestId) {
      matchStage.suggestId = new mongoose.Types.ObjectId(condition.suggestId);
    }

    if (condition?.leaderId) {
      matchStage.leaderId = new mongoose.Types.ObjectId(condition.leaderId);
    }

    if (condition?.userId) {
      matchStage.userId = new mongoose.Types.ObjectId(condition.userId);
    }

    const pipeline: any = [
      { $match: matchStage },
      { $sort: { created_at: condition.sort || -1 } },
      {
        $lookup: {
          from: 'links',
          localField: 'linkId',
          foreignField: '_id',
          as: 'linkData',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userData',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'leaderId',
          foreignField: '_id',
          as: 'leaderData',
        },
      },
      {
        $lookup: {
          from: 'suggests',
          localField: 'suggestId',
          foreignField: '_id',
          as: 'suggestData',
        },
      },
    ];

    if (condition?.search) {
      pipeline.push({
        $match: {
          $or: [
            {
              'linkData.linkUrl': {
                $regex: condition.search.trim(),
                $options: 'i',
              },
            },
            { telegramId: { $regex: condition.search.trim(), $options: 'i' } },
            { reason: { $regex: condition.search.trim(), $options: 'i' } },
            { response: { $regex: condition.search.trim(), $options: 'i' } },
          ],
        },
      });
    }

    pipeline.push({
      $facet: {
        pagination: [
          { $count: 'total' },
          {
            $addFields: {
              page: toNumber(condition.page),
              limit: toNumber(condition.limit),
            },
          },
        ],
        data: [
          { $skip: toNumber(condition.skip) },
          { $limit: toNumber(condition.limit) },
          {
            $project: {
              userId: {
                $cond: {
                  if: { $isArray: '$userData' },
                  then: {
                    _id: { $arrayElemAt: ['$userData._id', 0] },
                    name: { $arrayElemAt: ['$userData.name', 0] },
                    email: { $arrayElemAt: ['$userData.email', 0] },
                  },
                  else: '$userId',
                },
              },
              leaderId: {
                $cond: {
                  if: { $isArray: '$leaderData' },
                  then: {
                    _id: { $arrayElemAt: ['$leaderData._id', 0] },
                    name: { $arrayElemAt: ['$leaderData.name', 0] },
                    email: { $arrayElemAt: ['$leaderData.email', 0] },
                  },
                  else: '$leaderId',
                },
              },
              created_at: 1,
              updated_at: 1,
              deleted_at: 1,
              reason: 1,
              response: 1,
              status: 1,
              __v: 1,
              linkId: { $arrayElemAt: ['$linkData', 0] },
              suggestId: { $arrayElemAt: ['$suggestData', 0] },
            },
          },
        ],
      },
    });

    const histories = await this.historyModel.aggregate(pipeline).exec();

    const items = histories[0]?.data;
    const pagination = histories[0]?.pagination[0];

    if (!items?.length) {
      return {
        pagination: {
          total: 0,
          page: toNumber(condition.page),
          limit: toNumber(condition.limit),
        },
        items: [],
      };
    }

    return { pagination, items };
  }
}
