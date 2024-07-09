import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { paginationQuery } from '../../utils';
import { HistoryRepositoryInterface } from '../../repositories/history.interface.repository';
import { UserRepositoryInterface } from '../../repositories/user.interface.repository';
import { UserService } from '../user/user.service';
import { History } from '../../entities/history.entity';
import { Types } from 'mongoose';
import { SuggestRepositoryInterface } from '../../repositories/suggest.interface.repository';
import { ERROR_CODES } from '../../common/error-code';

@Injectable()
export class HistoryService {
  constructor(
    @Inject('HistoryRepositoryInterface')
    private readonly historyRepo: HistoryRepositoryInterface,
    @Inject('UserRepositoryInterface')
    private readonly userRepo: UserRepositoryInterface,
    private readonly userService: UserService,
    @Inject('SuggestRepositoryInterface')
    private readonly suggestRepo: SuggestRepositoryInterface,
  ) {}

  async findAll(req) {
    try {
      const { limit, skip, page } = paginationQuery(req.query);

      const sort = req.query.sort === 'ASC' ? 1 : -1;

      let filter = {};
      if (req.query.status) {
        filter['$or'] = filter['$or'] || [];
        filter['$or'].push({
          status: new RegExp(req.query.status.toString(), 'i'),
        });
      }
      if (req.query.suggestId) {
        const folder = await this.suggestRepo.findById(req.query.suggestId);
        if (folder) {
          filter['suggestId'] = new Types.ObjectId(folder._id);
        } else {
          filter['suggestId'] = [];
        }
      }
      if (req.query.search) {
        filter['search'] = req.query.search;
      }

      const user = await this.userService.findById(req.user.sub);
      switch (user && user.roleId && user?.roleId['code']) {
        case 'leader':
          filter = Object.assign({}, filter, { leaderId: req.user.sub });
          break;
        case 'user':
          filter = Object.assign({}, filter, { userId: req.user.sub });
          break;
        default:
          break;
      }

      if (!filter['search']) {
        const sort = { _id: -1 };
        if (req.query.sort === 'ASC') sort._id = 1;
        return await this.historyRepo.findAll(filter, {
          limit,
          skip,
          sort,
          populate: [
            { path: 'linkId' },
            { path: 'userId', select: 'name email' },
            { path: 'leaderId', select: 'name email' },
            { path: 'suggestId', select: 'name' },
          ],
        });
      }

      const condition = {
        limit,
        skip,
        page,
        sort,
        ...filter,
      };
      return await this.historyRepo.findAllWithPagination(condition);
    } catch (e) {
      throw e;
    }
  }

  /* async findAll(req) {
    try {
      const { limit, skip } = paginationQuery(req.query);
      const sort = { _id: -1 };
      if (req.query.sort === 'ASC') sort._id = 1;

      let filter = {};
      if (req.query.status) {
        filter['$or'] = filter['$or'] || [];
        filter['$or'].push({
          status: new RegExp(req.query.status.toString(), 'i'),
        });
      }
      if (req.query.suggestId) {
        const folder = await this.suggestRepo.findById(req.query.suggestId);
        if (folder) {
          filter['suggestId'] = new Types.ObjectId(folder._id);
        } else {
          filter['suggestId'] = [];
        }
      }
      if (req.query.search) {
        filter['$or'] = filter['$or'] || [];
        filter['$or'].push({
          telegramId: new RegExp(req.query.search.toString(), 'i'),
          reason: new RegExp(req.query.search.toString(), 'i'),
        });
      }

      const user = await this.userService.findById(req.user.sub);
      switch (user && user.roleId && user?.roleId['code']) {
        case 'leader':
          filter = Object.assign({}, filter, { leaderId: req.user.sub });
          break;
        case 'user':
          filter = Object.assign({}, filter, { userId: req.user.sub });
          break;
        default:
          break;
      }

      return await this.historyRepo.findAll(filter, {
        limit,
        skip,
        sort,
        populate: [
          { path: 'linkId' },
          { path: 'userId', select: 'name email' },
          { path: 'leaderId', select: 'name email' },
          { path: 'suggestId', select: 'name' },
        ],
      });
    } catch (e) {
      throw e;
    }
  }*/

  async findOne(id): Promise<History> {
    try {
      const populateConfig = [
        { path: 'userId', select: 'name email' },
        { path: 'leaderId', select: 'name email' },
        { path: 'linkId' },
      ];
      const history = await this.historyRepo.findByIdWithSubFields(id, {
        populate: populateConfig,
      });
      if (!history) {
        throw new HttpException(
          ERROR_CODES.HISTORY_NOT_EXIST,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      return history;
    } catch (e) {
      throw e;
    }
  }
}
