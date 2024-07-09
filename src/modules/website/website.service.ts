import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { paginationQuery } from 'src/utils';
import { WebsiteRepositoryInterface } from 'src/repositories/website.interface.repository';
import { Website } from 'src/entities/website.entity';
import { UserWebsiteService } from '../userwebsite/userwebsite.service';
import { UserService } from '../user/user.service';
import { UserWebsiteRepositoryInterface } from '../../repositories/userwebsite.interface.repository';
import { Types } from 'mongoose';
import { SuggestRepositoryInterface } from '../../repositories/suggest.interface.repository';
import { LinkRepositoryInterface } from '../../repositories/link.interface.repository';
import { ERROR_CODES } from '../../common/error-code';

@Injectable()
export class WebsiteService {
  constructor(
    @Inject('UserWebsiteRepositoryInterface')
    private readonly userWebsiteRepo: UserWebsiteRepositoryInterface,
    @Inject('WebsiteRepositoryInterface')
    private readonly websiteRepo: WebsiteRepositoryInterface,
    @Inject('SuggestRepositoryInterface')
    private readonly suggestRepo: SuggestRepositoryInterface,
    @Inject('LinkRepositoryInterface')
    private readonly linkRepo: LinkRepositoryInterface,
    private readonly userWebsiteService: UserWebsiteService,
    private readonly userService: UserService,
  ) {}

  async findAll(req) {
    try {
      const { limit, skip } = paginationQuery(req.query);
      const sort = { _id: -1 };
      if (req.query.sort === 'ASC') sort._id = 1;
      const filter = {};
      if (req.query.search) {
        filter['$or'] = filter['$or'] || [];
        filter['$or'].push({
          // name: new RegExp(req.query.search.toString(), 'i'),
          domain: new RegExp(req.query.search.toString(), 'i'),
        });
      }

      const user = await this.userService.findById(req.user.sub);
      if (user && user.roleId && user.roleId['code'] === 'leader') {
        filter['leaderId'] = new Types.ObjectId(req.user.sub);
      }
      if (user && user.roleId && user.roleId['code'] === 'user') {
        return await this.userWebsiteService.findAll(req);
      }
      const populateConfig = [
        { path: 'createdBy', select: 'name email deleted_at' },
        { path: 'leaderId', select: 'name email deleted_at' },
      ];
      const websites = (await this.websiteRepo.findAll(filter, {
        limit,
        skip,
        sort,
        populate: populateConfig,
      })) as any;
      websites.items = await Promise.all(
        websites.items.map(async (website: any) => {
          const userWebsites = await this.userWebsiteService.findAll(
            req,
            website['_id'],
          );
          const suggestByWebSite = await this.suggestRepo.getSuggestCondition({
            websiteId: website['_id'],
          });
          let totalMoney = 0;
          if (suggestByWebSite?.length) {
            totalMoney = suggestByWebSite.reduce(
              (accumulator, currentValue) =>
                accumulator + currentValue.totalMoney,
              0,
            );
          }
          return {
            ...website['_doc'],
            members: userWebsites.reduce((users, item) => {
              if (item.userId && !item.userId['deleted_at']) {
                const user = {
                  ...item.userId?.toObject(),
                  leaderId: item?.leaderId ?? null,
                };
                users.push(user);
              }
              return users;
            }, []),
            totalMoney,
          };
        }),
      );
      return websites;
    } catch (e) {
      throw e;
    }
  }

  async create(createWebsiteDto, req): Promise<Website | any> {
    try {
      const payload = {
        ...createWebsiteDto,
        domain: createWebsiteDto.domain.toLowerCase(),
        createdBy: req.user.sub,
      };
      const findUser = await this.userService.findOne(req.user.sub);
      if (
        req?.user?.email === 'superadmin@gmail.com' ||
        findUser.roleId['code'] === 'admin'
      ) {
        if (!createWebsiteDto?.leaderId) {
          throw new HttpException(
            ERROR_CODES.LEADER_ID_REQUIRED,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        if (!createWebsiteDto?.userIdAddLinks?.length) {
          payload.leaderId = createWebsiteDto?.leaderId;
          return await this.websiteRepo.create(payload);
        }

        let isCreate = true;
        const itemError = [];
        for (const userId of createWebsiteDto?.userIdAddLinks) {
          const user = await this.userService.findById(userId);
          if (!user) {
            isCreate = false;
          }
          if (
            user?.leaderId?.['_id'].toHexString() !== createWebsiteDto.leaderId
          ) {
            isCreate = false;
            itemError.push(userId);
          }
        }
        if (!isCreate) {
          throw new HttpException(
            `${ERROR_CODES.USER_NOT_BELONG_TO_LEADER} id ${itemError}`,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        payload.leaderId = createWebsiteDto.leaderId;
        const newWebsite = await this.websiteRepo.create(payload);
        if (!newWebsite) {
          throw new HttpException(
            ERROR_CODES.CREATE_FAILED,
            HttpStatus.BAD_REQUEST,
          );
        }

        const userWebsite = {
          websiteId: newWebsite._id,
          userId: createWebsiteDto.userIdAddLinks,
          leaderId: newWebsite.leaderId,
        };
        await this.userWebsiteService.create(userWebsite);
        return newWebsite;
      }
      if (findUser.roleId['code'] === 'leader') {
        if (!createWebsiteDto?.userIdAddLinks?.length) {
          payload.leaderId = req.user.sub;
          return await this.websiteRepo.create(payload);
        }
        let isCreate = true;
        const itemError = [];
        for (const userId of createWebsiteDto?.userIdAddLinks) {
          const user = await this.userService.findById(userId);
          if (!user) {
            isCreate = false;
          }
          if (user.leaderId?.['_id'].toHexString() !== req.user.sub) {
            isCreate = false;
            itemError.push(userId);
          }
        }
        if (!isCreate) {
          throw new HttpException(
            `${ERROR_CODES.USER_NOT_BELONG_TO_LEADER} id ${itemError}`,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        payload.leaderId = req.user.sub;
        const newWebsite = await this.websiteRepo.create(payload);
        if (!newWebsite) {
          throw new HttpException(
            ERROR_CODES.CREATE_FAILED,
            HttpStatus.BAD_REQUEST,
          );
        }
        if (
          createWebsiteDto.userIdAddLinks &&
          createWebsiteDto.userIdAddLinks.length
        ) {
          const userWebsite = {
            websiteId: newWebsite._id,
            userId: createWebsiteDto.userIdAddLinks,
            leaderId: newWebsite.leaderId,
          };
          await this.userWebsiteService.create(userWebsite);
          return newWebsite;
        }
        return newWebsite;
      }
      if (findUser.roleId['code'] === 'user') {
        if (!findUser.leaderId && !findUser.leaderId['_id']) {
          throw new HttpException(
            ERROR_CODES.USER_NOT_BELONG_TO_LEADER,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        if (
          createWebsiteDto.userIdAddLinks &&
          createWebsiteDto.userIdAddLinks.length
        ) {
          throw new HttpException(
            ERROR_CODES.USER_NOT_PERMISSION,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        payload.leaderId = findUser.leaderId['_id'];
        const newWebsite = await this.websiteRepo.create(payload);
        if (!newWebsite) {
          throw new HttpException(
            ERROR_CODES.CREATE_FAILED,
            HttpStatus.BAD_REQUEST,
          );
        }
        const userWebsite = {
          websiteId: newWebsite._id,
          userId: findUser._id,
          leaderId: newWebsite.leaderId,
        };
        await this.userWebsiteService.createOne(userWebsite);
        return newWebsite;
      }
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  async update(id, updateWebsiteDto, req): Promise<Website> {
    try {
      // const website = await this.websiteRepo.findByIdWithSubFields(id, {});
      const website = await this.websiteRepo.findById(id);
      if (!website) {
        throw new HttpException(
          ERROR_CODES.WEBSITE_NOT_EXIST,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      const payload = {
        ...updateWebsiteDto,
        domain: updateWebsiteDto.domain.toLowerCase(),
      };
      const findUser = await this.userService.findOne(req.user.sub);
      if (findUser.roleId['code'] === 'admin') {
        if (!updateWebsiteDto?.leaderId) {
          throw new HttpException(
            ERROR_CODES.LEADER_ID_REQUIRED,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        if (!updateWebsiteDto?.userIdAddLinks?.length) {
          payload.leaderId = updateWebsiteDto?.leaderId;
          const website = await this.websiteRepo.update(id, payload);
          await this.userWebsiteRepo.deleteManyByCondition({
            websiteId: id,
          });
          return website;
        }

        let isCreate = true;
        const itemError = [];
        for (const userId of updateWebsiteDto?.userIdAddLinks) {
          const user = await this.userService.findById(userId);
          if (!user) {
            isCreate = false;
          }
          if (
            user.leaderId?.['_id'].toHexString() !== updateWebsiteDto.leaderId
          ) {
            isCreate = false;
            itemError.push(userId);
          }
        }
        if (!isCreate) {
          throw new HttpException(
            `${ERROR_CODES.USER_NOT_BELONG_TO_LEADER} id ${itemError}`,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }

        // for (const user of updateWebsiteDto.userIdAddLinks) {
        //   await this.userWebsiteRepo.deleteManyByCondition({
        //     websiteId: id,
        //     userId: user,
        //   });
        // }

        await this.userWebsiteRepo.deleteManyByCondition({
          websiteId: id,
        });
        payload.leaderId = updateWebsiteDto.leaderId;
        const newWebsite = await this.websiteRepo.update(id, payload);

        const userWebsite = {
          websiteId: id,
          userId: updateWebsiteDto.userIdAddLinks,
          leaderId: newWebsite.leaderId,
        };
        await this.userWebsiteService.create(userWebsite);
        return newWebsite;
      }
      if (findUser.roleId['code'] === 'leader') {
        if (!updateWebsiteDto?.userIdAddLinks?.length) {
          payload.leaderId = req.user.sub;
          const website = await this.websiteRepo.update(id, payload);
          await this.userWebsiteRepo.deleteManyByCondition({
            websiteId: id,
          });
          return website;
        }
        let isCreate = true;
        const itemError = [];
        for (const userId of updateWebsiteDto?.userIdAddLinks) {
          const user = await this.userService.findById(userId);
          if (!user) {
            isCreate = false;
          }
          if (user.leaderId?.['_id'].toHexString() !== req.user.sub) {
            isCreate = false;
            itemError.push(userId);
          }
        }
        if (!isCreate) {
          throw new HttpException(
            `${ERROR_CODES.USER_NOT_BELONG_TO_LEADER} id ${itemError}`,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }

        // for (const user of updateWebsiteDto.userIdAddLinks) {
        //   await this.userWebsiteRepo.deleteManyByCondition({
        //     websiteId: id,
        //     userId: user,
        //   });
        // }

        await this.userWebsiteRepo.deleteManyByCondition({
          websiteId: id,
        });
        payload.leaderId = req.user.sub;
        const newWebsite = await this.websiteRepo.update(id, payload);
        const userWebsite = {
          websiteId: id,
          userId: updateWebsiteDto.userIdAddLinks,
          leaderId: newWebsite.leaderId,
        };
        await this.userWebsiteService.create(userWebsite);
        return newWebsite;
      }
      if (findUser.roleId['code'] === 'user') {
        if (!findUser.leaderId && !findUser.leaderId['_id']) {
          throw new HttpException(
            ERROR_CODES.USER_NOT_PERMISSION,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        if (
          updateWebsiteDto.userIdAddLinks &&
          updateWebsiteDto.userIdAddLinks.length
        ) {
          throw new HttpException(
            ERROR_CODES.USER_NOT_PERMISSION,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        payload.leaderId = findUser.leaderId['_id'];
        return await this.websiteRepo.update(id, payload);
      }
    } catch (e) {
      throw e;
    }
  }

  async findById(id, req): Promise<Website | any> {
    try {
      const user = await this.userService.findById(req.user.sub);
      if (user.roleId['code'] === 'user') {
        const populateConfig = [
          { path: 'leaderId', select: 'name email deleted_at' },
          { path: 'userId', select: 'name email deleted_at' },
          {
            path: 'websiteId',
            populate: [
              { path: 'leaderId', select: 'name email deleted_at' },
              { path: 'createdBy', select: 'name email deleted_at' },
            ],
          },
        ];
        const website =
          await this.userWebsiteRepo.findOneByConditionWithSubField(
            {
              websiteId: id,
              userId: req.user.sub,
            },
            {
              populate: populateConfig,
            },
          );
        if (!website) {
          throw new HttpException(
            ERROR_CODES.WEBSITE_NOT_FOUND,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        const suggestByWebSite = await this.suggestRepo.getSuggestCondition({
          websiteId: website._id,
        });
        let totalMoney = 0;
        if (suggestByWebSite?.length) {
          totalMoney = suggestByWebSite.reduce(
            (accumulator, currentValue) =>
              accumulator + currentValue.totalMoney,
            0,
          );
        }
        return {
          website: website.websiteId,
          userId: website.userId,
          totalMoney,
        };
      }
      const populateConfig = [
        { path: 'createdBy', select: 'name email deleted_at' },
        { path: 'leaderId', select: 'name email deleted_at' },
      ];
      const website = await this.websiteRepo.findByIdWithSubFields(id, {
        populate: populateConfig,
      });
      if (website === null) {
        throw new HttpException(
          ERROR_CODES.WEBSITE_NOT_EXIST,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      const userWebsites = await this.userWebsiteService.findAll(
        req,
        website['_id'],
      );
      const suggestByWebSite = await this.suggestRepo.getSuggestCondition({
        websiteId: website._id,
      });
      let totalMoney = 0;
      if (suggestByWebSite?.length) {
        totalMoney = suggestByWebSite.reduce(
          (accumulator, currentValue) => accumulator + currentValue.totalMoney,
          0,
        );
      }
      return {
        website,
        members: userWebsites.reduce((users, item) => {
          if (item.userId && !item.userId['deleted_at']) {
            const user = {
              ...item.userId?.toObject(),
              leaderId: item?.leaderId ?? null,
            };
            users.push(user);
          }
          return users;
        }, []),
        totalMoney,
      };
    } catch (e) {
      throw e;
    }
  }

  async delete(id): Promise<boolean> {
    try {
      const website = await this.websiteRepo.findById(id);
      if (website === null) {
        throw new HttpException(
          ERROR_CODES.WEBSITE_NOT_EXIST,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      const userWebSites = await this.userWebsiteService.findAllByWebsiteId(
        website._id,
      );
      if (userWebSites.length) {
        await this.userWebsiteRepo.deleteManyByCondition({
          websiteId: website._id,
        });
      }

      const suggests = await this.suggestRepo.getSuggestCondition({
        websiteId: website._id,
      });
      if (suggests.length) {
        for (const suggest of suggests) {
          const links = await this.linkRepo.findBySuggestIds({
            suggestId: suggest?._id,
          });
          if (links?.length) {
            await this.linkRepo.deleteManyByCondition({
              suggestId: suggest?._id,
            });
          }
        }
        await this.suggestRepo.deleteManyByCondition({
          websiteId: website?._id,
        });
      }
      return await this.websiteRepo.permanentlyDelete(id);
    } catch (e) {
      throw e;
    }
  }

  async deleteMany(ids): Promise<boolean> {
    try {
      // let isDelete = true;
      // const deleteItem = [];
      // const userWebsiteIds = [];
      // const linkIds = [];
      for (const id of ids) {
        const website = await this.websiteRepo.findById(id);
        if (!website) {
          throw new HttpException(
            `${ERROR_CODES.WEBSITE_NOT_EXIST} id ${id}`,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        const userWebSite =
          await this.userWebsiteService.findOneByWebsiteId(id);
        await this.userWebsiteRepo.softDelete(userWebSite._id);
        await this.websiteRepo.softDelete(id);
      }
      return true;
      // if (isDelete) {
      //   const deleteWebsites = await this.websiteRepo.deleteManyByCondition({
      //     _id: ids,
      //   });
      //   return deleteWebsites;
      // }
      // throw new HttpException(
      //   `${ERROR_CODES.WEBSITE_NOT_EXIST} id ${deleteItem}`,
      //   HttpStatus.UNPROCESSABLE_ENTITY,
      // );
    } catch (e) {
      throw e;
    }
  }
}
