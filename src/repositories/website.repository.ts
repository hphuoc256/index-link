import { BaseRepositoryAbstract } from './base/base.abstract.repository';
import { WebsiteRepositoryInterface } from './website.interface.repository';
import { Website, WebsiteDocument } from '../entities/website.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PopulateOptions, Types } from 'mongoose';
import { FilterInterface } from '../modules/website/interface/filter.interface';

export class WebsiteRepository
  extends BaseRepositoryAbstract<Website>
  implements WebsiteRepositoryInterface
{
  constructor(
    @InjectModel(Website.name)
    private readonly websiteModel: Model<Website>,
  ) {
    super(websiteModel);
  }
  async find(query: any): Promise<Website[]> {
    return await this.websiteModel.find(query).exec();
  }
  async findById(id: string): Promise<Website | null> {
    try {
      return await this.websiteModel.findById(id).exec();
    } catch (e) {
      return null;
    }
  }

  async findByIdWithSubFields(
    id: string,
    options: {
      populate?: string[] | PopulateOptions | PopulateOptions[];
    },
  ): Promise<Website> {
    const item = await this.websiteModel
      .findById(id)
      .populate(options?.populate)
      .exec();
    return item.deleted_at ? null : item;
  }

  async findAllWithSubFields(filter: FilterInterface): Promise<Website[]> {
    try {
      const matchConditions = {
        'user_websites.userId': filter.userId
          ? new Types.ObjectId(filter.userId)
          : {
              $ne: null,
            },
        deleted_at: null,
      };
      if (filter.status) {
        matchConditions['status'] = filter.status;
      }

      const aggregatePipeline: any = [
        [
          {
            $skip: filter.skip,
          },
          {
            $limit: filter.limit,
          },
          {
            $lookup: {
              from: 'userwebsites',
              localField: '_id',
              foreignField: 'websiteId',
              as: 'user_websites',
            },
          },
          {
            $unwind: '$user_websites',
          },
          {
            $match: matchConditions,
          },
          {
            $lookup: {
              from: 'users',
              localField: 'user_websites.userId',
              foreignField: '_id',
              as: 'userDetails',
            },
          },
          {
            $unwind: '$userDetails',
          },
          {
            $lookup: {
              from: 'users',
              localField: 'leaderId',
              foreignField: '_id',
              as: 'leader',
            },
          },
          {
            $unwind: {
              path: '$leader',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'createdBy',
              foreignField: '_id',
              as: 'createdBy',
            },
          },
          {
            $unwind: {
              path: '$leader',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $unwind: {
              path: '$createdBy',
              preserveNullAndEmptyArrays: true,
            },
          },
          ...(filter.search
            ? [
                {
                  $match: {
                    $or: [
                      { domain: { $regex: new RegExp(filter.search, 'i') } },
                      { name: { $regex: new RegExp(filter.search, 'i') } },
                      {
                        description: { $regex: new RegExp(filter.search, 'i') },
                      },
                    ],
                  },
                },
              ]
            : []),
          {
            $sort: {
              [filter.orderBy]: filter?.sort?.toUpperCase() === 'DESC' ? -1 : 1,
            },
          },
          {
            $group: {
              _id: '$_id',
              leader: {
                $first: {
                  _id: '$leader._id',
                  email: '$leader.email',
                  name: '$leader.name',
                },
              },
              createdBy: {
                $first: {
                  _id: '$createdBy._id',
                  email: '$createdBy.email',
                  name: '$createdBy.name',
                },
              },
              name: { $first: '$name' },
              domain: { $first: '$domain' },
              description: { $first: '$description' },
              status: { $first: '$status' },
              deleted_at: { $first: '$deleted_at' },
              members: {
                $push: {
                  userId: '$userDetails._id',
                  name: '$userDetails.name',
                  email: '$userDetails.email',
                },
              },
            },
          },
        ],
      ];

      return await this.websiteModel.aggregate(aggregatePipeline).exec();
    } catch (e) {
      return [];
    }
  }

  async findByIdWithSubFields2(id: string, req): Promise<Website | null> {
    try {
      const matchConditions = {
        'user_websites.userId':
          req && req?.user?.sub
            ? new Types.ObjectId(req?.user?.sub)
            : {
                $ne: null,
              },
        deleted_at: null,
      };

      const result = await this.websiteModel.aggregate([
        {
          $match: { _id: new Types.ObjectId(id) },
        },
        {
          $lookup: {
            from: 'userwebsites',
            localField: '_id',
            foreignField: 'websiteId',
            as: 'userwebsites',
          },
        },
        {
          $unwind: '$userwebsites',
        },
        {
          $match: matchConditions,
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userwebsites.userId',
            foreignField: '_id',
            as: 'userDetails',
          },
        },
        {
          $unwind: '$userDetails',
        },
        {
          $group: {
            _id: '$_id',
            createdBy: { $first: '$createdBy' },
            leaderId: { $first: '$leaderId' },
            name: { $first: '$name' },
            domain: { $first: '$domain' },
            description: { $first: '$description' },
            status: { $first: '$status' },
            members: {
              $push: {
                userId: '$userDetails._id',
                name: '$userDetails.name',
                email: '$userDetails.email',
              },
            },
          },
        },
      ]);
      return result.length > 0 ? result[0] : null;
    } catch (e) {
      return null;
    }
  }

  async findAllByCondition(condition?: object): Promise<Website[] | any> {
    return this.websiteModel.find({ ...condition, deleted_at: null });
  }

  async updateMany(condition?: object, set?: object) {
    await this.websiteModel.updateMany({ ...condition }, { $set: { ...set } });
    return true;
  }
}
