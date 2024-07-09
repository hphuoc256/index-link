import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { UserWebsite } from 'src/entities/userwebsite.entity';
import { paginationQuery } from 'src/utils';
import { UserWebsiteRepositoryInterface } from 'src/repositories/userwebsite.interface.repository';
import { CreateUserWebsiteDto } from './dto/create-userwebsite.dto';
import { Types } from 'mongoose';
import { UserService } from '../user/user.service';
import { ERROR_CODES } from '../../common/error-code';
import { CreateOneUserWebsiteDto } from './dto/create-one-userwebsite.dto';

@Injectable()
export class UserWebsiteService {
  constructor(
    @Inject('UserWebsiteRepositoryInterface')
    private readonly userWebsiteRepo: UserWebsiteRepositoryInterface,
    private readonly userService: UserService,
  ) {}

  async findAll(req, websiteId = null) {
    try {
      const { limit, skip } = paginationQuery(req.query);
      const sort = { _id: -1 };
      if (req.query.sort === 'ASC') sort._id = 1;

      const filter = {};
      const user = await this.userService.findOne(req.user.sub);
      if (user && user.roleId && user.roleId['code'] === 'user') {
        filter['userId'] = new Types.ObjectId(req.user.sub);
        const populateConfig = [
          {
            path: 'websiteId',
            populate: [
              { path: 'leaderId', select: 'name email deleted_at' },
              { path: 'createdBy', select: 'name email deleted_at' },
            ],
          },
          { path: 'userId', select: 'name email deleted_at' },
          { path: 'leaderId', select: 'name email deleted_at' },
        ];

        const data = (await this.userWebsiteRepo.findAll(filter, {
          limit,
          skip,
          sort,
          populate: populateConfig,
        })) as any;
        data.items = await Promise.all(
          data.items.map(async (item: any) => {
            return {
              website: item.websiteId,
              userId: item.userId,
            };
          }),
        );
        return data;
      }
      // if (req.query.search) {
      //   filter['$or'] = filter['$or'] || [];
      //   filter['$or'].push({
      //     name: new RegExp(req.query.search.toString(), 'i'),
      //   });
      // }
      filter['websiteId'] = new Types.ObjectId(websiteId);
      const populateConfig = [
        { path: 'websiteId' },
        { path: 'userId', select: 'name email deleted_at' },
        { path: 'leaderId', select: 'name email deleted_at' },
      ];

      const data = await this.userWebsiteRepo.findAll(filter, {
        limit: 99999,
        // skip,
        sort,
        populate: populateConfig,
      });
      return data.items;
    } catch (e) {
      throw e;
    }
  }

  async create(createUserWebsiteDto: CreateUserWebsiteDto) {
    try {
      const { websiteId, userId, leaderId } = createUserWebsiteDto;
      return await Promise.all(
        userId.map(async (id) => {
          const payload = {
            websiteId: websiteId,
            userId: id,
            leaderId: leaderId,
          };
          const data = await this.userWebsiteRepo.create(payload);
          return data;
        }),
      );
    } catch (e) {
      throw e;
    }
  }

  async createOne(createUserWebsiteDto: CreateOneUserWebsiteDto) {
    try {
      return await this.userWebsiteRepo.create(createUserWebsiteDto);
    } catch (e) {
      throw e;
    }
  }

  async update(id, userWebsiteRepo): Promise<UserWebsite> {
    try {
      const userWebsite = await this.userWebsiteRepo.findByIdWithSubFields(
        id,
        {},
      );
      if (!userWebsite) {
        throw new HttpException(
          ERROR_CODES.USER_WEBSITE_NOT_EXIST,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      return await this.userWebsiteRepo.update(id, userWebsiteRepo);
    } catch (e) {
      throw e;
    }
  }

  async findById(id): Promise<UserWebsite | null> {
    try {
      const populateConfig = [
        { path: 'websiteId', select: 'name description status' },
        { path: 'userId', select: 'name email' },
      ];
      const userWebsite = await this.userWebsiteRepo.findByIdWithSubFields(id, {
        populate: populateConfig,
      });
      if (userWebsite === null) {
        throw new HttpException(
          ERROR_CODES.USER_WEBSITE_NOT_EXIST,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      return userWebsite;
    } catch (e) {
      throw e;
    }
  }

  async delete(id): Promise<boolean> {
    try {
      const userWebsite = await this.userWebsiteRepo.findByIdWithSubFields(
        id,
        {},
      );
      if (!userWebsite) {
        throw new HttpException(
          ERROR_CODES.USER_WEBSITE_NOT_EXIST,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      return await this.userWebsiteRepo.softDelete(id);
    } catch (e) {
      throw e;
    }
  }

  async findByCondition(condition: object): Promise<UserWebsite | null> {
    try {
      const userWebsite =
        await this.userWebsiteRepo.findOneByCondition(condition);
      if (!userWebsite) return null;
      return userWebsite;
    } catch (e) {
      throw null;
    }
  }

  async deleteMany(ids): Promise<boolean> {
    try {
      let isDelete = true;
      const deleteItem = [];
      for (const id of ids) {
        const userWebsite = await this.userWebsiteRepo.findById(id);
        if (!userWebsite) {
          deleteItem.push(id);
          isDelete = false;
        }
      }
      if (isDelete)
        return await this.userWebsiteRepo.deleteManyByCondition({ _id: ids });
      throw new HttpException(
        `${ERROR_CODES.WEBSITE_NOT_EXIST} id: ${deleteItem}`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    } catch (e) {
      throw e;
    }
  }

  async findOneByWebsiteId(websiteId: string) {
    try {
      return await this.userWebsiteRepo.findOneByCondition({ websiteId });
    } catch (e) {
      throw e;
    }
  }

  async findAllByWebsiteId(websiteId: string) {
    try {
      return await this.userWebsiteRepo.findAllByCondition({
        websiteId: websiteId,
      });
    } catch (e) {
      throw e;
    }
  }
}
