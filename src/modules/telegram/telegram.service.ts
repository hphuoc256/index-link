import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { paginationQuery } from '../../utils';
import { ROLE } from '../../common/enum';
import { ERROR_CODES } from '../../common/error-code';
import { UserService } from '../user/user.service';
import { TelegramRepositoryInterface } from '../../repositories/telegram.interface.repository';
import { UserRepositoryInterface } from '../../repositories/user.interface.repository';
import { Telegram } from '../../entities/telegram.entity';
const TELEGRAM_TOKEN: string = '6989596782:AAFy80_uq3tpb6f1WlqOXN5C8Q7KdS_bLFM';
// const TELEGRAM_CHAT_ID = NODE_ENV === 'development' ? '-1002003528677' : '-1002103804643';
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

@Injectable()
export class TelegramService {
  constructor(
    @Inject('TelegramRepositoryInterface')
    private readonly telegramRepo: TelegramRepositoryInterface,
    @Inject('UserRepositoryInterface')
    private readonly userRepo: UserRepositoryInterface,
    private readonly userService: UserService,
  ) {}

  async sendMessageTelegram(sendMessageDto: any): Promise<boolean> {
    try {
      // const TELEGRAM_CHAT_ID =  process.env.NODE_ENV === 'development' ? '-1002003528677' : '-1002103804643';
      const groups: Telegram = await this.telegramRepo.findOneByCondition({
        leaderId: sendMessageDto.leaderId,
      });
      if (groups) {
        return !!(await bot.sendMessage(
          groups?.groupId,
          sendMessageDto.message,
          {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          },
        ));
      }
    } catch (e) {
      return false;
    }
  }

  async findAll(req) {
    try {
      const { limit, skip } = paginationQuery(req.query);
      const sort = { _id: -1 };
      if (req.query.sort === 'ASC') sort._id = 1;

      let filter = {};

      const userLogin = await this.userService.findOne(req.user.sub);

      switch (userLogin.roleId['code']) {
        case ROLE.LEADER:
          filter = {
            leaderId: req.user.sub,
          };
      }

      if (req.query.search) {
        filter['$or'] = filter['$or'] || [];
        filter['$or'].push({
          linkUrl: new RegExp(req.query.search.toString(), 'i'),
        });
      }

      return await this.telegramRepo.findAll(filter, {
        limit,
        skip,
        sort,
      });
    } catch (e) {
      throw e;
    }
  }

  async create(telegramConfigCreateDto, req) {
    try {
      const userLogin = await this.userService.findOne(req.user.sub);
      if (userLogin.roleId['code'] === ROLE.LEADER) {
        const checkExist = await this.telegramRepo.findOneByCondition({
          leaderId: req.user.sub,
        });
        if (checkExist) {
          throw new HttpException(
            ERROR_CODES.TELEGRAM_EXIST,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        telegramConfigCreateDto.leaderId = req.user.sub;
      } else {
        const populateConfig = [
          { path: 'roleId', select: 'name code description' },
        ];
        const leader = await this.userRepo.findByIdWithSubFields(
          telegramConfigCreateDto.leaderId,
          {
            populate: populateConfig,
          },
        );
        if (!leader) {
          throw new HttpException(
            ERROR_CODES.LEADER_NOT_FOUND,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        if (leader.roleId['code'] !== ROLE.LEADER) {
          throw new HttpException(
            ERROR_CODES.USER_NOT_LEADER,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        const checkExist = await this.telegramRepo.findOneByCondition({
          leaderId: telegramConfigCreateDto.leaderId,
        });
        if (checkExist) {
          throw new HttpException(
            ERROR_CODES.TELEGRAM_EXIST,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
      }

      return await this.telegramRepo.create(telegramConfigCreateDto);
    } catch (e) {
      throw e;
    }
  }

  async update(id, telegramConfigUpdateDto, req) {
    try {
      const userLogin = await this.userService.findOne(req.user.sub);
      const telegramConfig = await this.telegramRepo.findOneById(id);
      switch (userLogin.roleId['code']) {
        case ROLE.LEADER:
          const telegramConfigByIdLeaderId =
            await this.telegramRepo.findOneByCondition({
              leaderId: req.user.sub,
              _id: id,
            });
          if (!telegramConfigByIdLeaderId) {
            throw new HttpException(
              ERROR_CODES.TELEGRAMCONFIG_IS_NOT_ALLOW_UPDATE,
              HttpStatus.UNPROCESSABLE_ENTITY,
            );
          }
          telegramConfigUpdateDto.leaderId = req.user.sub;
          break;
        default:
          if (!telegramConfig) {
            throw new HttpException(
              ERROR_CODES.TELEGRAMCONFIG_IS_NOT_ALLOW_UPDATE,
              HttpStatus.UNPROCESSABLE_ENTITY,
            );
          }
          const populateConfig = [
            { path: 'roleId', select: 'name code description' },
          ];
          const leader = await this.userRepo.findByIdWithSubFields(
            telegramConfigUpdateDto.leaderId,
            {
              populate: populateConfig,
            },
          );
          if (!leader) {
            throw new HttpException(
              ERROR_CODES.LEADER_NOT_FOUND,
              HttpStatus.UNPROCESSABLE_ENTITY,
            );
          }
          if (leader.roleId['code'] !== ROLE.LEADER) {
            throw new HttpException(
              ERROR_CODES.USER_NOT_LEADER,
              HttpStatus.UNPROCESSABLE_ENTITY,
            );
          }
      }
      return await this.telegramRepo.update(id, telegramConfigUpdateDto);
    } catch (e) {
      throw e;
    }
  }

  async findById(id, req) {
    try {
      let result: any;
      const userLogin = await this.userService.findOne(req.user.sub);
      switch (userLogin.roleId['code']) {
        case ROLE.LEADER:
          result = await this.telegramRepo.findOneByCondition({
            leaderId: req.user.sub,
            _id: id,
          });
          if (!result)
            throw new HttpException(
              ERROR_CODES.TELEGRAMCONFIG_NOT_EXITS,
              HttpStatus.UNPROCESSABLE_ENTITY,
            );
        case ROLE.ADMIN:
          result = await this.telegramRepo.findOneByCondition({ _id: id });
          if (!result)
            throw new HttpException(
              ERROR_CODES.TELEGRAMCONFIG_NOT_EXITS,
              HttpStatus.UNPROCESSABLE_ENTITY,
            );
      }
      return result;
    } catch (e) {
      throw e;
    }
  }

  async delete(id, req) {
    try {
      const auth = await this.userRepo.findByIdWithSubFields(req.user.sub, {
        populate: [{ path: 'roleId', select: 'name code description' }],
      });

      const filter = {
        _id: id,
      };
      if (auth.roleId['code'] !== ROLE.ADMIN) filter['leaderId'] = req.user.sub;
      const telegramConfig = await this.telegramRepo.findOneByCondition({
        ...filter,
      });
      if (!telegramConfig) {
        throw new HttpException(
          ERROR_CODES.TELEGRAMCONFIG_NOT_EXITS,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      return await this.telegramRepo.softDelete(id);
    } catch (e) {
      throw e;
    }
  }
}
