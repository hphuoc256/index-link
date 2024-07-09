import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { UserRepositoryInterface } from '../../repositories/user.interface.repository';
import { User } from '../../entities/user.entity';
import { RoleRepositoryInterface } from '../../repositories/role.interface.repository';
import { UserCreateOrUpdate } from './user.interface';
import { Types } from 'mongoose';
import { HashService } from '../../services/hash.service';
import { FindAllResponse } from '../../types/global';
import { paginationQuery } from '../../utils';
import { ROLE } from '../../common/enum';
import { ERROR_CODES } from '../../common/error-code';
import { WebsiteRepositoryInterface } from '../../repositories/website.interface.repository';
import { UserWebsiteRepositoryInterface } from '../../repositories/userwebsite.interface.repository';
import { TelegramRepositoryInterface } from '../../repositories/telegram.interface.repository';

@Injectable()
export class UserService {
  constructor(
    @Inject('UserRepositoryInterface')
    private readonly userRepo: UserRepositoryInterface,
    @Inject('RoleRepositoryInterface')
    private readonly roleRepo: RoleRepositoryInterface,
    @Inject('WebsiteRepositoryInterface')
    private readonly websiteRepo: WebsiteRepositoryInterface,
    @Inject('UserWebsiteRepositoryInterface')
    private readonly userWebsiteRepo: UserWebsiteRepositoryInterface,
    @Inject('TelegramRepositoryInterface')
    private readonly telegramRepo: TelegramRepositoryInterface,
    private hashService: HashService,
  ) {}

  async findAll(req): Promise<FindAllResponse<User>> {
    try {
      const { limit, skip } = paginationQuery(req.query);
      const sort = { _id: -1 };
      if (req.query.sort && req.query.sort === 'ASC') sort._id = 1;

      const leader = await this.userRepo.findByIdWithSubFields(req.user.sub, {
        populate: { path: 'roleId', select: 'name code description' },
      });
      let filterOption = {};
      if (leader && leader.roleId && leader.roleId['code'] === ROLE.LEADER) {
        filterOption = {
          leaderId: req.user.sub,
        };
      } else {
        if (req.query.leaderId) {
          const leader = await this.userRepo.findByIdWithSubFields(
            req.query.leaderId,
            {
              populate: { path: 'roleId', select: 'name code description' },
            },
          );
          if (leader && leader.roleId['code'] !== ROLE.LEADER) {
            throw new HttpException(
              ERROR_CODES.USER_ARE_NOT_LEADER,
              HttpStatus.UNPROCESSABLE_ENTITY,
            );
          }
          if (leader) {
            filterOption['leaderId'] = new Types.ObjectId(leader._id);
          } else {
            filterOption['leaderId'] = [];
          }
        }
      }
      const filter = { ...filterOption };
      if (req.query.search) {
        filter['$or'] = filter['$or'] || [];
        filter['$or'].push({
          name: new RegExp(req.query.search.toString(), 'i'),
        });
        filter['$or'].push({
          email: new RegExp(req.query.search.toString(), 'i'),
        });
      }
      if (req.query.role) {
        const role = await this.roleRepo.findOneByCondition({
          code: req.query.role,
        });
        if (role) {
          filter['roleId'] = new Types.ObjectId(role._id);
        } else {
          filter['roleId'] = [];
        }
      }
      const populateConfig = [
        { path: 'roleId', select: 'name code description' },
        { path: 'leaderId', select: 'name email' },
      ];
      return await this.userRepo.findAll(filter, {
        limit,
        skip,
        sort,
        populate: populateConfig,
      });
    } catch (e) {
      throw e;
    }
  }

  async create(userCreate, req): Promise<User> {
    try {
      const checkExist = await this.findByEmail(userCreate.email, false);
      if (checkExist) {
        throw new HttpException(
          ERROR_CODES.EMAIL_EXIST,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      const role = await this.roleRepo.findOneByCondition({
        code: userCreate.role,
      });
      if (!role) {
        throw new HttpException(
          ERROR_CODES.ROLE_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      const adminOrLeader = await this.findByEmail(req.user.email, false);
      const userPayload: UserCreateOrUpdate = {
        ...userCreate,
        password: await this.hashService.hashPassword(userCreate.password),
        roleId: role._id,
      };
      if (adminOrLeader.email === process.env.SUPER_ADMIN) {
        switch (userCreate.role) {
          case ROLE.USER:
            if (!userCreate.leaderId) {
              throw new HttpException(
                ERROR_CODES.LEADER_REQUIRED,
                HttpStatus.UNPROCESSABLE_ENTITY,
              );
            }
            const checkLeader = await this.userRepo.findOneById(
              userCreate.leaderId,
            );
            if (!checkLeader) {
              throw new HttpException(
                ERROR_CODES.LEADER_NOT_FOUND,
                HttpStatus.UNPROCESSABLE_ENTITY,
              );
            } else {
              const roleLeader = await this.roleRepo.findOneById(
                checkLeader.roleId,
              );
              if (roleLeader.code !== ROLE.LEADER) {
                throw new HttpException(
                  ERROR_CODES.LEADER_NOT_FOUND,
                  HttpStatus.UNPROCESSABLE_ENTITY,
                );
              }
            }
            userPayload.leaderId = userCreate.leaderId;
            const user = await this.userRepo.create(userPayload);
            return await this.userRepo.findByEmail(user.email, false);
          case ROLE.LEADER:
            userPayload.leaderId = null;
            return await this.userRepo.create(userPayload);
          case ROLE.ADMIN:
            userPayload.leaderId = null;
            return await this.userRepo.create(userPayload);
        }
        throw new HttpException(
          ERROR_CODES.CREATE_FAILED,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      switch (adminOrLeader.roleId['code']) {
        case ROLE.ADMIN:
          switch (userCreate.role) {
            case ROLE.USER:
              if (!userCreate.leaderId) {
                throw new HttpException(
                  ERROR_CODES.LEADER_REQUIRED,
                  HttpStatus.UNPROCESSABLE_ENTITY,
                );
              }
              const checkLeader = await this.userRepo.findOneById(
                userCreate.leaderId,
              );
              if (!checkLeader) {
                throw new HttpException(
                  ERROR_CODES.LEADER_NOT_FOUND,
                  HttpStatus.UNPROCESSABLE_ENTITY,
                );
              } else {
                const roleLeader = await this.roleRepo.findOneById(
                  checkLeader.roleId,
                );
                if (roleLeader.code !== ROLE.LEADER) {
                  throw new HttpException(
                    ERROR_CODES.LEADER_NOT_FOUND,
                    HttpStatus.UNPROCESSABLE_ENTITY,
                  );
                }
              }
              userPayload.leaderId = userCreate.leaderId;
              const user = await this.userRepo.create(userPayload);
              return await this.userRepo.findByEmail(user.email, false);
            case ROLE.LEADER:
              userPayload.leaderId = null;
              return await this.userRepo.create(userPayload);
            case ROLE.ADMIN:
              userPayload.leaderId = null;
              return await this.userRepo.create(userPayload);
          }
          throw new HttpException(
            ERROR_CODES.CREATE_FAILED,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        case ROLE.LEADER:
          switch (userCreate.role) {
            case ROLE.USER:
              userPayload.leaderId = req.user.sub;
              const user = await this.userRepo.create(userPayload);
              return await this.userRepo.findByEmail(user.email, false);
          }
          throw new HttpException(
            ERROR_CODES.CREATE_FAILED,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
      }
      throw new HttpException(
        ERROR_CODES.CREATE_FAILED,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    } catch (e) {
      throw e;
    }
  }

  async update(id, userUpdate, req): Promise<User | any> {
    try {
      const role = await this.roleRepo.findOneByCondition({
        code: userUpdate.role,
      });
      if (!role) {
        throw new HttpException(
          ERROR_CODES.ROLE_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      const adminOrLeader = await this.findByEmail(req.user.email, false);

      const userById = await this.userRepo.findOneById(id);
      if (
        userById?.email === (process.env.SUPER_ADMIN || 'superadmin@gmail.com')
      ) {
        throw new HttpException(
          ERROR_CODES.USER_NOT_UPDATE,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const userPayload: UserCreateOrUpdate = {
        ...userUpdate,
        roleId: role._id,
      };
      if (userUpdate.password)
        userPayload.password = await this.hashService.hashPassword(
          userUpdate.password,
        );
      if (adminOrLeader.email === process.env.SUPER_ADMIN) {
        switch (userUpdate.role) {
          case ROLE.USER:
            if (!userUpdate.leaderId) {
              throw new HttpException(
                ERROR_CODES.LEADER_REQUIRED,
                HttpStatus.UNPROCESSABLE_ENTITY,
              );
            }
            const checkLeader = await this.userRepo.findOneById(
              userUpdate.leaderId,
            );
            if (!checkLeader) {
              throw new HttpException(
                ERROR_CODES.LEADER_NOT_FOUND,
                HttpStatus.UNPROCESSABLE_ENTITY,
              );
            } else {
              const roleLeader = await this.roleRepo.findOneById(
                checkLeader.roleId,
              );
              if (roleLeader.code !== ROLE.LEADER) {
                throw new HttpException(
                  ERROR_CODES.LEADER_NOT_FOUND,
                  HttpStatus.UNPROCESSABLE_ENTITY,
                );
              }
            }
            userPayload.leaderId = userUpdate.leaderId;
            const user = await this.userRepo.update(id, userPayload);
            const websiteByLeaderId = await this.websiteRepo.findAllByCondition(
              { leaderId: user._id },
            );
            const telegramByLeaderId =
              await this.telegramRepo.findAllByCondition({
                leaderId: user._id,
              });
            if (websiteByLeaderId && websiteByLeaderId.length) {
              await this.websiteRepo.updateMany(
                { leaderId: user._id },
                { leaderId: null },
              );
              for (const website of websiteByLeaderId) {
                const userWebsites =
                  await this.userWebsiteRepo.findAllByCondition({
                    websiteId: website._id,
                  });
                if (userWebsites && userWebsites.length) {
                  await this.userWebsiteRepo.deleteManyByCondition({
                    websiteId: website._id,
                  });
                }
              }
            }
            if (telegramByLeaderId && telegramByLeaderId.length) {
              await this.telegramRepo.updateMany(
                { leaderId: user._id },
                { leaderId: null },
              );
            }
            return await this.userRepo.findByEmail(user.email, false);

          case ROLE.LEADER:
            userPayload.leaderId = null;
            return await this.userRepo.update(id, userPayload);

          case ROLE.ADMIN:
            userPayload.leaderId = null;
            return await this.userRepo.update(id, userPayload);
        }
        throw new HttpException(
          ERROR_CODES.UPDATE_FAILED,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      switch (adminOrLeader.roleId['code']) {
        case ROLE.ADMIN:
          switch (userUpdate.role) {
            case ROLE.USER:
              if (!userUpdate.leaderId) {
                throw new HttpException(
                  ERROR_CODES.LEADER_REQUIRED,
                  HttpStatus.UNPROCESSABLE_ENTITY,
                );
              }
              const checkLeader = await this.userRepo.findOneById(
                userUpdate.leaderId,
              );
              if (!checkLeader) {
                throw new HttpException(
                  ERROR_CODES.LEADER_NOT_FOUND,
                  HttpStatus.UNPROCESSABLE_ENTITY,
                );
              } else {
                const roleLeader = await this.roleRepo.findOneById(
                  checkLeader.roleId,
                );
                if (roleLeader.code !== ROLE.LEADER) {
                  throw new HttpException(
                    ERROR_CODES.LEADER_NOT_FOUND,
                    HttpStatus.UNPROCESSABLE_ENTITY,
                  );
                }
              }
              userPayload.leaderId = userUpdate.leaderId;

              // Kiểm tra nếu leader là chính user đó
              if (id.toString() === userPayload.leaderId.toString()) {
                throw new HttpException(
                  ERROR_CODES.USER_CANNOT_BE_USER_OWN_LEADER,
                  HttpStatus.UNPROCESSABLE_ENTITY,
                );
              }
              const user = await this.userRepo.update(id, userPayload);
              const websiteByLeaderId =
                await this.websiteRepo.findAllByCondition({
                  leaderId: user._id,
                });
              const telegramByLeaderId =
                await this.telegramRepo.findAllByCondition({
                  leaderId: user._id,
                });
              if (websiteByLeaderId && websiteByLeaderId.length) {
                await this.websiteRepo.updateMany(
                  { leaderId: user._id },
                  { leaderId: null },
                );
                for (const website of websiteByLeaderId) {
                  const userWebsites =
                    await this.userWebsiteRepo.findAllByCondition({
                      websiteId: website._id,
                    });
                  if (userWebsites && userWebsites.length) {
                    await this.userWebsiteRepo.deleteManyByCondition({
                      websiteId: website._id,
                    });
                  }
                }
              }
              if (telegramByLeaderId && telegramByLeaderId.length) {
                await this.telegramRepo.updateMany(
                  { leaderId: user._id },
                  { leaderId: null },
                );
              }
              return await this.userRepo.findByEmail(user.email, false);
            case ROLE.LEADER:
              userPayload.leaderId = null;
              return await this.userRepo.update(id, userPayload);
            case ROLE.ADMIN:
              userPayload.leaderId = null;
              return await this.userRepo.update(id, userPayload);
          }
          throw new HttpException(
            ERROR_CODES.UPDATE_FAILED,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        case ROLE.LEADER:
          switch (userUpdate.role) {
            case ROLE.USER:
              userPayload.leaderId = req.user.sub;
              const user = await this.userRepo.update(id, userPayload);
              return await this.userRepo.findByEmail(user.email, false);
          }
          throw new HttpException(
            ERROR_CODES.UPDATE_FAILED,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
      }
      throw new HttpException(
        ERROR_CODES.UPDATE_FAILED,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    } catch (e) {
      throw e;
    }
  }

  async delete(id, req = null): Promise<any> {
    try {
      const user = await this.userRepo.findOneById(id);

      if (user?.email === (process.env.SUPER_ADMIN || 'superadmin@gmail.com')) {
        throw new HttpException(
          ERROR_CODES.USER_NOT_DELETE,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      if (req && req?.user?.email === user?.email) {
        throw new HttpException(
          ERROR_CODES.CAN_NOT_DELETE_YOURSELF,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      return await this.userRepo.permanentlyDelete(id);
    } catch (e) {
      throw e;
    }
  }

  async findOne(id): Promise<User | null> {
    try {
      const populateConfig = [
        { path: 'roleId', select: 'name code description' },
        { path: 'leaderId', select: 'name email' },
      ];
      const user = await this.userRepo.findByIdWithSubFields(id, {
        populate: populateConfig,
      });
      if (!user) {
        throw new HttpException(
          ERROR_CODES.USER_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      return user;
    } catch (e) {
      throw e;
    }
  }

  async findByEmail(email, isPassword = false): Promise<User | null> {
    try {
      return await this.userRepo.findByEmail(email, isPassword);
    } catch (e) {
      return null;
    }
  }

  async getWithRoleById({ id }) {
    try {
      const user = await this.userRepo.findOneById(id);
      if (!user) {
        throw new HttpException(
          ERROR_CODES.USER_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      const role = await this.roleRepo.findById(user?.roleId);
      return { user, role };
    } catch (e) {
      throw e;
    }
  }

  async findById(id): Promise<User | null> {
    try {
      const populateConfig = [
        { path: 'roleId', select: 'name code description' },
        { path: 'leaderId', select: 'name email' },
      ];
      const user = await this.userRepo.findByIdWithSubFields(id, {
        populate: populateConfig,
      });
      if (!user) return null;
      return user;
    } catch (e) {
      return null;
    }
  }
}
