import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { NotificationRepositoryInterface } from '../../repositories/notification.interface.repository';
import { paginationQuery } from '../../utils';
import { ERROR_CODES } from '../../common/error-code';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class NotifyService {
  constructor(
    @InjectModel('Notification')
    private readonly notificationModel: Model<Notification>,
    @Inject('NotificationRepositoryInterface')
    private readonly notifyRepo: NotificationRepositoryInterface,
  ) {}

  async findAll(req) {
    try {
      const { limit, skip } = paginationQuery(req.query);
      const sort = { _id: -1 };
      if (req.query.sort === 'ASC') sort._id = 1;

      const filter = {
        userId: req.user.sub,
      };
      if (req.query.search) {
        filter['$or'] = filter['$or'] || [];
        filter['$or'].push({
          title: new RegExp(req.query.search.trim().toString(), 'i'),
          description: new RegExp(req.query.search.trim().toString(), 'i'),
        });
      }

      if (req.query.isRead) {
        filter['$or'] = filter['$or'] || [];
        filter['$or'].push({
          isRead: req.query.isRead,
        });
      }

      return await this.notifyRepo.findAll(filter, {
        limit,
        skip,
        sort,
      });
    } catch (e) {
      throw e;
    }
  }

  async findOne(id) {
    try {
      return this.notifyRepo.findOneById(id);
    } catch (e) {
      throw e;
    }
  }

  async update(id, req) {
    try {
      const notify = await this.notifyRepo.findOneById(id);
      if (notify.userId.toString() !== req.user.sub) {
        throw new HttpException(
          ERROR_CODES.NOTIFY_IS_NOT_ALLOW_UPDATE,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      return await this.notifyRepo.update(id, {
        isRead: 1,
      });
    } catch (e) {
      throw e;
    }
  }

  async delete(id, req) {
    try {
      const notify = await this.notifyRepo.findOneById(id);
      if (notify.userId.toString() !== req.user.sub) {
        throw new HttpException(
          ERROR_CODES.NOTIFY_IS_NOT_ALLOW_UPDATE,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      return await this.notifyRepo.softDelete(id);
    } catch (e) {
      throw e;
    }
  }

  async updateNotiToRead(): Promise<boolean> {
    try {
      await this.notificationModel.updateMany(
        { isRead: 0 },
        { $set: { isRead: 1 } },
      );
      return true;
    } catch (e) {
      throw e;
    }
  }
}
