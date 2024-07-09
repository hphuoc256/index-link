import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { SuggestRepositoryInterface } from '../../repositories/suggest.interface.repository';
import { paginationQuery } from '../../utils';
import { Suggest } from '../../entities/suggest.entity';
import { UserService } from '../user/user.service';
import { Types } from 'mongoose';
import { LinkRepositoryInterface } from '../../repositories/link.interface.repository';
import { ERROR_CODES } from '../../common/error-code';
import { ROLE } from '../../common/enum';
import { Website } from '../../entities/website.entity';
import { WebsiteRepositoryInterface } from '../../repositories/website.interface.repository';
import { toNumber } from 'lodash';
import { UserRepositoryInterface } from 'src/repositories/user.interface.repository';
import { DeleteManySuggestDto } from './dto/delete-many-suggest.dto';

@Injectable()
export class SuggestService {
  constructor(
    @Inject('SuggestRepositoryInterface')
    private readonly suggestRepo: SuggestRepositoryInterface,
    @Inject('LinkRepositoryInterface')
    private readonly linkRepo: LinkRepositoryInterface,
    private readonly userService: UserService,
    @Inject('WebsiteRepositoryInterface')
    private readonly websiteRepo: WebsiteRepositoryInterface,
    @Inject('UserRepositoryInterface')
    private readonly userRepo: UserRepositoryInterface,
  ) {}

  async findByWebsite(req, websiteId) {
    try {
      const { limit, skip } = paginationQuery(req.query);
      const sort = { _id: -1 };
      if (req.query.sort === 'ASC') sort._id = 1;

      const filter = {
        websiteId: websiteId,
      };
      if (req.query.search) {
        filter['$or'] = filter['$or'] || [];
        filter['$or'].push({
          name: new RegExp(req.query.search.toString(), 'i'),
        });
        filter['$or'].push({
          telegramId: new RegExp(req.query.search.toString(), 'i'),
        });
      }

      const user = await this.userService.findOne(req.user.sub);
      if (user && user.roleId && user.roleId['code'] === 'user') {
        filter['userId'] = new Types.ObjectId(req.user.sub);
      }
      const populateConfig = [
        { path: 'userId', select: 'name email' },
        { path: 'websiteId' },
      ];

      return await this.suggestRepo.findAll(filter, {
        limit,
        skip,
        sort,
        populate: populateConfig,
      });
    } catch (e) {
      throw e;
    }
  }

  async findAll(req) {
    try {
      const { limit, skip } = paginationQuery(req.query);
      const sort = { _id: -1 };
      if (req.query.sort === 'ASC') sort._id = 1;

      const filter = {};
      if (req.query.search) {
        filter['$or'] = filter['$or'] || [];
        filter['$or'].push({
          name: new RegExp(req.query.search.toString(), 'i'),
        });
        filter['$or'].push({
          telegramId: new RegExp(req.query.search.toString(), 'i'),
        });
      }

      if (req.query.searchDomainOrUserName) {
        const searchRegex = new RegExp(
          '.*' + req.query.searchDomainOrUserName.toString(),
          'i',
        );

        const users = await this.userRepo.find({
          name: { $regex: searchRegex },
        });

        const websites = await this.websiteRepo.find({ domain: searchRegex });

        if (users.length === 0 && websites.length === 0) {
          return [];
        }

        if (users.length > 0) {
          filter['$or'] = filter['$or'] || [];
          filter['$or'].push({
            userId: { $in: users.map((user) => user._id) },
          });
        }

        if (websites.length > 0) {
          filter['$or'] = filter['$or'] || [];
          filter['$or'].push({
            websiteId: { $in: websites.map((website) => website._id) },
          });
        }
      }

      const populateConfig = [
        { path: 'userId', select: 'name email' },
        { path: 'websiteId' },
      ];

      const user = await this.userService.findOne(req.user.sub);
      if (user && user.roleId && user.roleId['code'] === ROLE.USER) {
        filter['userId'] = new Types.ObjectId(req.user.sub);

        return await this.suggestRepo.findAll(filter, {
          limit,
          skip,
          sort,
          populate: populateConfig,
        });
      }
      if (user && user.roleId && user.roleId['code'] === ROLE.LEADER) {
        const suggests = await this.suggestRepo.findAll(filter, {
          limit,
          skip,
          sort,
          populate: populateConfig,
        });
        suggests.items = await Promise.all(
          suggests.items.filter((suggest) => {
            return (
              suggest.websiteId['leaderId'].toString() === user._id.toString()
            );
          }),
        );
        suggests.pagination.total = suggests.items.length;
        return suggests;
      }
      return await this.suggestRepo.findAll(filter, {
        limit,
        skip,
        sort,
        populate: populateConfig,
      });
    } catch (e) {
      throw e;
    }
  }

  async create(createSuggestDto, req): Promise<Suggest> {
    try {
      const suggestPayload = {
        ...createSuggestDto,
        userId: req.user.sub,
      };
      return await this.suggestRepo.create(suggestPayload);
    } catch (e) {
      throw e;
    }
  }

  async update(id, updateSuggest): Promise<Suggest> {
    try {
      const suggest = await this.suggestRepo.findById(id);
      if (!suggest) {
        throw new HttpException(
          ERROR_CODES.SUGGEST_NOT_EXIST,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      let totalMoney = suggest.totalMoney;

      if (updateSuggest?.totalMoney) {
        totalMoney = totalMoney + toNumber(updateSuggest?.totalMoney);
      }

      const dataUpdate = {
        ...updateSuggest,
        totalMoney,
      };
      return await this.suggestRepo.update(id, dataUpdate);
    } catch (e) {
      throw e;
    }
  }

  async findById(id): Promise<Suggest | any> {
    try {
      const populateConfig = [
        { path: 'userId', select: 'name email' },
        { path: 'websiteId' },
      ];
      const suggest = await this.suggestRepo.findByIdWithSubFields(id, {
        populate: populateConfig,
      });

      if (suggest === null) {
        throw new HttpException(
          ERROR_CODES.SUGGEST_NOT_EXIST,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      return suggest;
    } catch (e) {
      throw e;
    }
  }

  async delete(id): Promise<boolean> {
    try {
      const suggest = await this.suggestRepo.findById(id);
      if (suggest === null) {
        throw new HttpException(
          ERROR_CODES.SUGGEST_NOT_EXIST,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      const links = await this.linkRepo.findBySuggestIds({
        suggestId: suggest._id,
      });
      if (links.length) {
        await this.linkRepo.deleteManyByCondition({ suggestId: suggest._id });
      }

      return await this.suggestRepo.permanentlyDelete(id);
    } catch (e) {
      throw e;
    }
  }

  async deleteMany(
    deleteManySuggestDto: DeleteManySuggestDto,
    req,
  ): Promise<boolean> {
    try {
      const user = await this.userService.findOne(req.user.sub);
      if (user && user.roleId && user.roleId['code'] === ROLE.USER) {
        const suggestError = [];
        const suggestSuccess = [];
        let isDeleteLink = false;
        for (const id of deleteManySuggestDto.ids) {
          const suggest = await this.suggestRepo.findById(id);
          if (!suggest) {
            throw new HttpException(
              `${ERROR_CODES.SUGGEST_NOT_EXIST} id: ${id}`,
              HttpStatus.UNPROCESSABLE_ENTITY,
            );
          }
          if (suggest.userId.toString() !== req.user.sub) {
            suggestError.push(id);
          }
          const links = await this.linkRepo.findBySuggestIds({
            suggestId: suggest._id,
          });
          if (links.length) {
            isDeleteLink = true;
          }
          suggestSuccess.push(id);
        }
        if (suggestError.length) {
          throw new HttpException(
            ERROR_CODES.SUGGEST_NOT_EXIST_IN_USER + suggestError.join(', '),
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        if (isDeleteLink) {
          await this.linkRepo.deleteManyByCondition({
            suggestId: { $in: deleteManySuggestDto.ids },
          });
        }
        return await this.suggestRepo.deleteManyByCondition({
          _id: deleteManySuggestDto.ids,
        });
      } else if (user && user.roleId && user.roleId['code'] === ROLE.LEADER) {
        const suggestError = [];
        const suggestSuccess = [];
        let isDeleteLink = false;
        for (const id of deleteManySuggestDto.ids) {
          const populateConfig = [{ path: 'websiteId' }];
          const suggest = await this.suggestRepo.findByIdWithSubFields(id, {
            populate: populateConfig,
          });
          if (!suggest) {
            throw new HttpException(
              `${ERROR_CODES.SUGGEST_NOT_EXIST} id: ${id}`,
              HttpStatus.UNPROCESSABLE_ENTITY,
            );
          }
          if (suggest.websiteId['leaderId'].toString() !== req.user.sub) {
            suggestError.push(id);
          }
          const links = await this.linkRepo.findBySuggestIds({
            suggestId: suggest._id,
          });
          if (links.length) {
            isDeleteLink = true;
          }
          suggestSuccess.push(id);
        }
        if (suggestError.length) {
          throw new HttpException(
            ERROR_CODES.SUGGEST_NOT_EXIST_IN_LEADER + suggestError.join(', '),
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        if (isDeleteLink) {
          await this.linkRepo.deleteManyByCondition({
            suggestId: { $in: deleteManySuggestDto.ids },
          });
        }
        return await this.suggestRepo.deleteManyByCondition({
          _id: deleteManySuggestDto.ids,
        });
      }

      const suggestError = [];
      const suggestSuccess = [];
      let isDeleteLink = false;
      for (const id of deleteManySuggestDto.ids) {
        const suggest = await this.suggestRepo.findById(id);
        if (!suggest) {
          suggestError.push(id);
        }
        const links = await this.linkRepo.findBySuggestIds({
          suggestId: suggest._id,
        });
        if (links.length) {
          isDeleteLink = true;
        }
        suggestSuccess.push(id);
      }
      if (suggestError.length) {
        throw new HttpException(
          `${ERROR_CODES.SUGGEST_NOT_EXIST} id: ${suggestError.join(', ')}`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      if (isDeleteLink) {
        await this.linkRepo.deleteManyByCondition({
          suggestId: { $in: deleteManySuggestDto.ids },
        });
      }
      return await this.suggestRepo.deleteManyByCondition({
        _id: deleteManySuggestDto.ids,
      });
    } catch (e) {
      throw e;
    }
  }
}
