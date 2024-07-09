import { Injectable } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { MyLoggerService } from '../logger/logger.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Job } from '../../entities/job.entity';
import { Config } from '../../entities/config.entity';
import { History } from '../../entities/history.entity';
import { Link } from '../../entities/link.entity';
import { Suggest } from '../../entities/suggest.entity';
import {
  FOLLOW_LINK,
  INDEX_LINK,
  JOB_STATUS,
  JOB_TYPE,
  STATUS_CRON,
  STATUS_LINK,
} from '../../common/enum';
import { Website } from '../../entities/website.entity';
import { TelegramService } from '../telegram/telegram.service';
import { CheckLinkService } from '../../services/checkLink.service';
import { Notification } from '../../entities/notification.entity';
import { EventGateway } from '../event/event.gateway';
import { SuggestService } from '../suggest/suggest.service';
import { JobLockService } from './job-lock.service';
import {
  MAX_NUMBER_OF_CHUNK_DEFAULT_WEEK,
  splitArrayIntoChunks,
} from '../../utils';
import { LinkService } from '../link/link.service';
import { JobLockCheckLinkIndexService } from './job-lock-check-link-index.service';
import { JobLockIndexLinkService } from './job-lock-index-link.service';

@Injectable()
export class JobService {
  constructor(
    private logger: MyLoggerService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @InjectModel(Job.name)
    private readonly jobModel: Model<Job>,
    @InjectModel(Config.name)
    private readonly configModel: Model<Config>,
    @InjectModel(History.name)
    private readonly historyModel: Model<History>,
    @InjectModel(Link.name)
    private readonly linkModel: Model<Link>,
    @InjectModel(Suggest.name)
    private readonly suggestModel: Model<Suggest>,
    @InjectModel(Website.name)
    private readonly websiteModel: Model<Website>,
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
    private readonly checkLinkService: CheckLinkService,
    private readonly telegramService: TelegramService,
    private readonly suggestService: SuggestService,
    private readonly eventGateWay: EventGateway,
    private readonly lockService: JobLockService,
    private readonly linkService: LinkService,
    private readonly jobLockCheckLinkIndexService: JobLockCheckLinkIndexService,
    private readonly jobLockIndexLinkService: JobLockIndexLinkService,
  ) {
    this.logger.setContext('CronIndexService');
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'update-link-is-checked',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerUpdateLinkIsChecked() {
    await this.linkService.updateLinkIsChecked();
  }

  @Cron(CronExpression.EVERY_WEEK, {
    name: 'setup-daily-link',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerDaily() {
    await this.setUpJobDailyGuaranteed();
  }

  stopCronJob() {
    const job = this.schedulerRegistry.getCronJob('indexing');
    job.stop();
    console.log(job.lastDate());
  }

  deleteJob(jobName: string) {
    this.schedulerRegistry.deleteCronJob(jobName);
    this.logger.warn(`job ${jobName} deleted!`);
  }

  getCronJobs() {
    const jobs = this.schedulerRegistry.getCronJobs();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    jobs.forEach((value, key, map) => {
      let next;
      try {
        next = value.nextDates().toFormat('yyyy-LL-dd HH:mm:ss');
      } catch (e) {
        next = 'error: next fire date is in the past!';
      }
      this.logger.log(`job: ${key} -> next: ${next}`);
    });
  }

  async deleteJobInDb(id: string): Promise<void> {
    try {
      await this.jobModel.deleteOne({ _id: id });
    } catch (e) {}
  }

  async createHistory(dto: any): Promise<void> {
    try {
      const history = new this.historyModel(dto);
      await history.save();
    } catch (e) {}
  }

  async createJobMany(dto: any) {
    try {
      return await this.jobModel.insertMany(dto);
    } catch (e) {
      throw e;
    }
  }

  async createNotify(dto: any) {
    try {
      const notification = new this.notificationModel(dto);
      await notification.save();
    } catch (e) {}
  }

  async findAll(condition: any) {
    try {
      return await this.jobModel
        .find({
          ...condition,
        })
        .exec();
    } catch (e) {
      return [];
    }
  }

  private async handleJobCheckLink(job: Job): Promise<boolean> {
    const link: Link = await this.linkModel.findById(job.linkId).exec();

    const config: Config = await this.configModel
      .findById(job.configId)
      .populate('userId', 'name email telegramId')
      .exec();

    const suggest: Suggest = await this.suggestModel
      .findById(config.suggestId)
      .exec();

    const website: Website = await this.websiteModel
      .findById(suggest?.websiteId)
      .populate([{ path: 'leaderId', select: 'name email' }])
      .exec();

    if (link?.isChecked && link?.status === STATUS_LINK.SUCCESS) {
      if (website['leaderId']) {
        const history = await this.historyModel
          .findOne({
            linkId: job.linkId,
          })
          .sort({ _id: -1 });

        const userCheck = config['userId']['name']
          ? config['userId']['name'] + ' - ' + config['userId']['email']
          : '';

        const sendMessage = {
          message: `🔔<b>Thông báo link đã check trong ngày</b>🔔 \n<i>Link này đã được check trong ngày, vui lòng check lại vào ngày mai</i>\nLink: ${link?._id} [${link?.linkUrl}] \nWebsite: ${website?._id} [${website?.domain}] \nTrạng thái: ${link?.status}\nLý do: ${history.reason}\nNgười check: ${userCheck}`,
          leaderId: website['leaderId'],
        };
        await this.telegramService.sendMessageTelegram(sendMessage);
      }
      await this.deleteJobInDb(job._id);
      return true;
    }

    if (config && suggest && website) {
      const timer: number = suggest?.timer ? suggest?.timer * 1000 : 0;
      const response: any = await this.checkLinkService.send(
        job.linkUrl,
        website.domain,
        link?.keywords ?? [],
        timer,
      );

      this.logger.debug(
        `${JSON.stringify(response)}`,
        `Action -> Running Check linkID: ${link?._id}`,
      );

      if (response && response?.status === 'ok') {
        this.logger.error('JobService/response', response);
        /* Update link */
        const dataUpdate = {
          status: STATUS_LINK.SUCCESS,
          isChecked: true,
        };

        if (response?.isIndex) dataUpdate['isIndex'] = INDEX_LINK.INDEX;
        else dataUpdate['isIndex'] = INDEX_LINK.NOINDEX;

        if (response?.isFollow) dataUpdate['isFollow'] = FOLLOW_LINK.FOLLOW;
        else dataUpdate['isFollow'] = FOLLOW_LINK.NOFOLLOW;

        await this.linkModel.findOneAndUpdate(
          { _id: job.linkId, deleted_at: null },
          dataUpdate,
        );

        this.eventGateWay.sendStatusUpdate({
          linkId: job.linkId,
          leaderId: website.leaderId,
          suggestId: suggest?._id,
          status: STATUS_LINK.SUCCESS,
        });

        /* Create history */
        await this.createHistory({
          linkId: job.linkId,
          userId: link?.userId,
          leaderId: website.leaderId,
          status: STATUS_CRON.SUCCESS,
          suggestId: suggest?._id,
          telegramId: suggest?.telegramId,
          reason: response?.message,
          response: JSON.stringify(response),
        });

        /* Create notify */
        await this.createNotify({
          userId: config?.userId['_id'],
          title: 'Check link thành công',
          description: `Đã thực hiện Check link ${link?.linkUrl} của Website ${website?.domain}`,
        });
      } else {
        /*Update link*/
        const dataUpdate = {
          status: STATUS_LINK.CANCEL,
          isChecked: true,
        };

        if (response?.isFollow) dataUpdate['isFollow'] = FOLLOW_LINK.FOLLOW;
        else dataUpdate['isFollow'] = FOLLOW_LINK.NOFOLLOW;

        if (response?.isIndex) dataUpdate['isIndex'] = INDEX_LINK.INDEX;
        else dataUpdate['isIndex'] = INDEX_LINK.NOINDEX;

        await this.linkModel.findOneAndUpdate(
          { _id: job.linkId, deleted_at: null },
          dataUpdate,
        );

        this.eventGateWay.sendStatusUpdate({
          linkId: job.linkId,
          leaderId: website.leaderId,
          suggestId: suggest?._id,
          status: STATUS_LINK.CANCEL,
        });

        /* Create history */
        await this.createHistory({
          linkId: job.linkId,
          userId: link?.userId,
          leaderId: website.leaderId,
          status: STATUS_CRON.FAIL,
          suggestId: suggest?._id,
          telegramId: suggest?.telegramId,
          reason: response?.message,
          response: JSON.stringify(response),
        });

        if (website['leaderId']) {
          const sendMessage = {
            leaderId: website['leaderId'],
            message: `🔔<b>Thông báo check link</b>🔔\nNgười check: ${
              config?.userId['telegramId']
                ? `@` + config?.userId['telegramId']
                : config?.userId['email']
            }\nMã đơn hàng: ${suggest?.name}\nLink: ${link?._id} [${link?.linkUrl}] \nWebsite: ${website?._id} [${website?.domain}] \nTrạng thái: Thất bại \nLý do: ${response?.message}`,
          };
          await this.telegramService.sendMessageTelegram(sendMessage);
        }
        /* Create notify */
        await this.createNotify({
          userId: config?.userId['_id'],
          title: 'Check link thất bại',
          description: `Đã thực hiện Check link ${link?.linkUrl} của Website ${website?.domain}`,
        });
      }
    } else {
      this.logger.error('JobService/ScheduleGetLink', JSON.stringify(link));
      this.logger.error('JobService/ScheduleGetConfig', JSON.stringify(config));
      this.logger.error(
        'JobService/ScheduleGetSuggest',
        JSON.stringify(suggest),
      );
      this.logger.error(
        'JobService/ScheduleGetWebsite',
        JSON.stringify(website),
      );
    }
    return true;
  }

  private async handleJobCheckLinkIndex(job: Job): Promise<boolean> {
    const link = await this.linkModel.findById(job.linkId).exec();

    const config = await this.configModel
      .findById(job.configId)
      .populate('userId', 'name email telegramId')
      .exec();

    const suggest = await this.suggestModel.findById(config.suggestId).exec();

    const website = await this.websiteModel
      .findById(suggest?.websiteId)
      .populate([{ path: 'leaderId', select: 'name email' }])
      .exec();

    if (config && suggest && website) {
      const response: any = await this.checkLinkService.checkIndexExternal(
        job.linkUrl,
      );

      this.logger.debug(
        `${JSON.stringify(response)}`,
        `Action -> Running check link index: ${link?._id}`,
      );

      if (response && response?.status === 'ok') {
        this.logger.error('JobService/response', response);
        /* Update link */
        await this.linkModel.findOneAndUpdate(
          { _id: job.linkId, deleted_at: null },
          { indexed: INDEX_LINK.INDEX },
        );
        this.eventGateWay.sendStatusUpdate({
          linkId: job.linkId,
          leaderId: website.leaderId,
          suggestId: suggest?._id,
          indexed: INDEX_LINK.INDEX,
        });

        /* Create notify */
        await this.createNotify({
          userId: config?.userId['_id'],
          title: 'Check indexed thành công',
          description: `Đã thực hiện Check INDEXED ${link?.linkUrl} của Website ${website?.domain}`,
        });
      } else {
        /*Update link*/
        await this.linkModel.findOneAndUpdate(
          { _id: job.linkId, deleted_at: null },
          { indexed: INDEX_LINK.NOINDEX },
        );
        this.eventGateWay.sendStatusUpdate({
          linkId: job.linkId,
          leaderId: website.leaderId,
          suggestId: suggest?._id,
          indexed: INDEX_LINK.NOINDEX,
        });

        /* Create notify */
        await this.createNotify({
          userId: config?.userId['_id'],
          title: 'Check INDEXED thất bại',
          description: `Đã thực hiện Check INDEXED ${link?.linkUrl} của Website ${website?.domain}`,
        });
      }
    } else {
      this.logger.error('JobService/ScheduleGetLink', JSON.stringify(link));
      this.logger.error('JobService/ScheduleGetConfig', JSON.stringify(config));
      this.logger.error(
        'JobService/ScheduleGetSuggest',
        JSON.stringify(suggest),
      );
      this.logger.error(
        'JobService/ScheduleGetWebsite',
        JSON.stringify(website),
      );
    }

    return true;
  }

  private async handleJobIndexLink(job: Job): Promise<boolean> {
    const link = await this.linkModel.findById(job.linkId).exec();

    const config = await this.configModel
      .findById(job.configId)
      .populate('userId', 'name email telegramId')
      .exec();

    const suggest = await this.suggestModel.findById(config.suggestId).exec();

    const website = await this.websiteModel
      .findById(suggest?.websiteId)
      .populate([{ path: 'leaderId', select: 'name email' }])
      .exec();

    if (config && suggest && website) {
      const response: any = await this.checkLinkService.indexSinbyte(
        job.linkUrl,
        website['leaderId'],
      );

      this.logger.debug(
        `${JSON.stringify(response)}`,
        `Action -> Running index linkID: ${link?._id}`,
      );

      if (response && response?.status === 'ok') {
        this.logger.error('JobService/response', response);
        /* Update link */
        await this.linkModel.findOneAndUpdate(
          { _id: job.linkId, deleted_at: null },
          { indexed: INDEX_LINK.INDEX },
        );
        await this.suggestService.update(suggest?._id, {
          totalMoney: process.env.MONEY_OF_SINBYTE,
        });
        this.eventGateWay.sendStatusUpdate({
          linkId: job.linkId,
          leaderId: website.leaderId,
          suggestId: suggest?._id,
          indexed: INDEX_LINK.INDEX,
        });

        /* Create notify */
        await this.createNotify({
          userId: config?.userId['_id'],
          title: 'Indexed thành công',
          description: `Đã thực hiện INDEXED ${link?.linkUrl} của Website ${website?.domain}`,
        });
      } else {
        /*Update link*/
        await this.linkModel.findOneAndUpdate(
          { _id: job.linkId, deleted_at: null },
          {
            indexed: INDEX_LINK.FAIL,
          },
        );
        this.eventGateWay.sendStatusUpdate({
          linkId: job.linkId,
          leaderId: website.leaderId,
          suggestId: suggest?._id,
          indexed: INDEX_LINK.FAIL,
        });

        if (website['leaderId']) {
          const sendMessage = {
            message: `🔔<b>Thông báo check link</b>🔔\nNgười check: ${
              config?.userId['telegramId']
                ? `@` + config?.userId['telegramId']
                : config?.userId['email']
            }\nMã đơn hàng: ${suggest?.name}\nLink: ${link?._id} [${link?.linkUrl}] \nWebsite: ${website?._id} [${website?.domain}] \nTrạng thái: Thất bại \nLý do: ${response?.message}`,
          };
          await this.telegramService.sendMessageTelegram(sendMessage);
        }
        /* Create notify */
        await this.createNotify({
          userId: config?.userId['_id'],
          title: 'INDEXED thất bại',
          description: `Đã thực hiện INDEXED ${link?.linkUrl} của Website ${website?.domain}`,
        });
      }
    } else {
      this.logger.error('JobService/ScheduleGetLink', JSON.stringify(link));
      this.logger.error('JobService/ScheduleGetConfig', JSON.stringify(config));
      this.logger.error(
        'JobService/ScheduleGetSuggest',
        JSON.stringify(suggest),
      );
      this.logger.error(
        'JobService/ScheduleGetWebsite',
        JSON.stringify(website),
      );
      await this.deleteJobInDb(job._id);
    }

    return true;
  }

  async setUpJobDailyGuaranteed(): Promise<void> {
    const suggestExpired = await this.suggestModel
      .find({
        guaranteed: {
          $ne: null,
          $lt: new Date(),
        },
        isChecked: true,
        deleted_at: null,
      })
      .exec();
    const suggestExpiredIds = suggestExpired.map((suggest) => suggest._id);

    /* Delete all link of suggestExpiredIds expired */
    await this.linkModel.deleteMany({ suggestId: { $in: suggestExpiredIds } });

    try {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        'Action -> Cron Start Setup Job Daily Guaranteed',
      );
      const suggests = await this.suggestModel
        .find({
          guaranteed: {
            $ne: null,
            $gt: new Date(),
          },
          deleted_at: null,
        })
        .exec();

      const dataInsertJobs = [];

      if (suggests?.length) {
        for (const suggest of suggests) {
          const links = await this.linkModel
            .find({ suggestId: suggest._id, deleted_at: null })
            .lean();
          if (links?.length) {
            for (const link of links) {
              const linkIsRunning: Job = await this.jobModel
                .findOne({ linkId: link._id })
                .exec();
              if (!linkIsRunning) {
                dataInsertJobs.push({
                  linkId: link._id,
                  linkUrl: link.linkUrl,
                  suggestId: suggest._id,
                  type: JOB_TYPE.DAILY,
                  status: JOB_STATUS.WAITING,
                });
              }
            }
          }
        }
      }
      if (dataInsertJobs.length) {
        const maxChunkSize = Math.ceil(
          dataInsertJobs.length / MAX_NUMBER_OF_CHUNK_DEFAULT_WEEK,
        );

        const chunkLinks = splitArrayIntoChunks(
          dataInsertJobs,
          0,
          maxChunkSize,
        );
        for (const key in chunkLinks) {
          await this.jobModel.insertMany(chunkLinks[key]);
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    }
  }

  private async handleJobDailyCheckLink(job: Job) {
    // Link daily with guaranteed
    const link = await this.linkModel
      .findOne({ _id: job.linkId, deleted_at: null })
      .populate([
        { path: 'userId', select: 'name email' },
        { path: 'suggestId' },
      ])
      .exec();

    const suggest: any = link?.suggestId;

    const website = await this.websiteModel
      .findById(suggest?.websiteId)
      .populate([{ path: 'leaderId', select: 'name email' }])
      .exec();

    if (suggest && website) {
      const timer: number = suggest?.timer ? suggest?.timer * 1000 : 10000;
      const response: any = await this.checkLinkService.send(
        job.linkUrl,
        website.domain,
        link?.keywords ?? [],
        timer,
      );

      this.logger.debug(
        `${JSON.stringify(response)}`,
        `Action -> Running Daily Check linkID: ${link?._id}`,
      );

      if (response && response?.status === 'ok') {
        this.logger.error('JobService/response', response);
        /* Update link */
        const dataUpdate = {
          status: STATUS_LINK.SUCCESS,
        };

        if (response?.isIndex) dataUpdate['isIndex'] = INDEX_LINK.INDEX;
        else dataUpdate['isIndex'] = INDEX_LINK.NOINDEX;

        if (response?.isFollow) dataUpdate['isFollow'] = FOLLOW_LINK.FOLLOW;
        else dataUpdate['isFollow'] = FOLLOW_LINK.NOFOLLOW;

        await this.linkModel.findOneAndUpdate(
          { _id: job.linkId, deleted_at: null },
          dataUpdate,
        );

        this.eventGateWay.sendStatusUpdate({
          linkId: job.linkId,
          leaderId: website.leaderId,
          suggestId: suggest?._id,
          status: STATUS_LINK.SUCCESS,
        });
        /* Delete job if index success */
        await this.deleteJobInDb(job?._id);
      } else {
        /*Update link*/
        const dataUpdate = {
          status: STATUS_LINK.CANCEL,
        };
        if (response?.isIndex) dataUpdate['isIndex'] = INDEX_LINK.INDEX;
        else dataUpdate['isIndex'] = INDEX_LINK.NOINDEX;

        if (response?.isFollow) dataUpdate['isFollow'] = FOLLOW_LINK.FOLLOW;
        else dataUpdate['isFollow'] = FOLLOW_LINK.NOFOLLOW;

        await this.linkModel.findOneAndUpdate(
          { _id: job.linkId, deleted_at: null },
          dataUpdate,
        );

        this.eventGateWay.sendStatusUpdate({
          linkId: job.linkId,
          leaderId: website.leaderId,
          suggestId: suggest?._id,
          status: STATUS_LINK.CANCEL,
        });

        if (website['leaderId']) {
          const sendMessage: any = {
            message: `⚡️<b>Thông báo check link weekly</b>⚡️ \nLink: ${link?._id} [${link?.linkUrl}] \nWebsite: ${website?._id} [${website?.domain}] \nTrạng thái: Thất bại \nLý do: ${response?.message}`,
            leaderId: website['leaderId'],
          };
          await this.telegramService.sendMessageTelegram(sendMessage);
        }
      }
    } else {
      this.logger.error('JobService/ScheduleGetLink', JSON.stringify(link));
      this.logger.error(
        'JobService/ScheduleGetSuggest',
        JSON.stringify(suggest),
      );
      this.logger.error(
        'JobService/ScheduleGetWebsite',
        JSON.stringify(website),
      );
    }

    return true;
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'daily-check-link-1',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerDailyCheckLink1() {
    await this.handleCronDailyCheckLink1();
  }
  async handleCronDailyCheckLink1(): Promise<void> {
    if (this.lockService.isLockedDailyCheckLink1()) {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        'Action -> Cron Start Daily Check Link 1',
      );
      return;
    }
    this.lockService.lockDailyCheckLink1();
    try {
      const jobs: any = await this.jobModel
        .find({
          status: JOB_STATUS.WAITING,
          type: JOB_TYPE.DAILY,
          numberOfLoop: 1,
        })
        .limit(50)
        .lean();

      if (jobs && jobs.length) {
        for (const job of jobs) {
          const result = await this.handleJobDailyCheckLink(job);
          if (result) await this.deleteJobInDb(job?._id); // Delete job if index success
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    } finally {
      this.lockService.unlockDailyCheckLink1();
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'daily-check-link-2',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerDailyCheckLink2() {
    await this.handleCronDailyCheckLink2();
  }
  async handleCronDailyCheckLink2(): Promise<void> {
    if (this.lockService.isLockedDailyCheckLink2()) {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        'Action -> Cron Start Daily Check Link 2',
      );
      return;
    }
    this.lockService.lockDailyCheckLink2();
    try {
      const jobs: any = await this.jobModel
        .find({
          status: JOB_STATUS.WAITING,
          type: JOB_TYPE.DAILY,
          numberOfLoop: 2,
        })
        .limit(50)
        .lean();

      if (jobs && jobs.length) {
        for (const job of jobs) {
          const result = await this.handleJobDailyCheckLink(job);
          if (result) await this.deleteJobInDb(job?._id); // Delete job if index success
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    } finally {
      this.lockService.unlockDailyCheckLink2();
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'daily-check-link-3',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerDailyCheckLink3() {
    await this.handleCronDailyCheckLink3();
  }
  async handleCronDailyCheckLink3(): Promise<void> {
    if (this.lockService.isLockedDailyCheckLink3()) {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        'Action -> Cron Start Daily Check Link 3',
      );
      return;
    }
    this.lockService.lockDailyCheckLink3();
    try {
      const jobs: any = await this.jobModel
        .find({
          status: JOB_STATUS.WAITING,
          type: JOB_TYPE.DAILY,
          numberOfLoop: 3,
        })
        .limit(50)
        .lean();

      if (jobs && jobs.length) {
        for (const job of jobs) {
          const result = await this.handleJobDailyCheckLink(job);
          if (result) await this.deleteJobInDb(job?._id); // Delete job if index success
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    } finally {
      this.lockService.unlockDailyCheckLink3();
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'daily-check-link-4',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerDailyCheckLink4() {
    await this.handleCronDailyCheckLink4();
  }
  async handleCronDailyCheckLink4(): Promise<void> {
    if (this.lockService.isLockedDailyCheckLink4()) {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        'Action -> Cron Start Daily Check Link 4',
      );
      return;
    }
    this.lockService.lockDailyCheckLink4();
    try {
      const jobs: any = await this.jobModel
        .find({
          status: JOB_STATUS.WAITING,
          type: JOB_TYPE.DAILY,
          numberOfLoop: 4,
        })
        .limit(50)
        .lean();

      if (jobs && jobs.length) {
        for (const job of jobs) {
          const result = await this.handleJobDailyCheckLink(job);
          if (result) await this.deleteJobInDb(job?._id); // Delete job if index success
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    } finally {
      this.lockService.unlockDailyCheckLink4();
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'daily-check-link-5',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerDailyCheckLink5() {
    await this.handleCronDailyCheckLink5();
  }
  async handleCronDailyCheckLink5(): Promise<void> {
    if (this.lockService.isLockedDailyCheckLink5()) {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        'Action -> Cron Start Daily Check Link 5',
      );
      return;
    }
    this.lockService.lockDailyCheckLink5();
    try {
      const jobs: any = await this.jobModel
        .find({
          status: JOB_STATUS.WAITING,
          type: JOB_TYPE.DAILY,
          numberOfLoop: 5,
        })
        .limit(50)
        .lean();

      if (jobs && jobs.length) {
        for (const job of jobs) {
          const result = await this.handleJobDailyCheckLink(job);
          if (result) await this.deleteJobInDb(job?._id); // Delete job if index success
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    } finally {
      this.lockService.unlockDailyCheckLink5();
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'daily-check-link-6',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerDailyCheckLink6() {
    await this.handleCronDailyCheckLink6();
  }
  async handleCronDailyCheckLink6(): Promise<void> {
    if (this.lockService.isLockedDailyCheckLink6()) {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        'Action -> Cron Start Daily Check Link 6',
      );
      return;
    }
    this.lockService.lockDailyCheckLink6();
    try {
      const jobs: any = await this.jobModel
        .find({
          status: JOB_STATUS.WAITING,
          type: JOB_TYPE.DAILY,
          numberOfLoop: 6,
        })
        .limit(50)
        .lean();

      if (jobs && jobs.length) {
        for (const job of jobs) {
          const result = await this.handleJobDailyCheckLink(job);
          if (result) await this.deleteJobInDb(job?._id); // Delete job if index success
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    } finally {
      this.lockService.unlockDailyCheckLink6();
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'daily-check-link-7',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerDailyCheckLink7() {
    await this.handleCronDailyCheckLink7();
  }
  async handleCronDailyCheckLink7(): Promise<void> {
    if (this.lockService.isLockedDailyCheckLink7()) {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        'Action -> Cron Start Daily Check Link 7',
      );
      return;
    }
    this.lockService.lockDailyCheckLink7();
    try {
      const jobs: any = await this.jobModel
        .find({
          status: JOB_STATUS.WAITING,
          type: JOB_TYPE.DAILY,
          numberOfLoop: 7,
        })
        .limit(50)
        .lean();

      if (jobs && jobs.length) {
        for (const job of jobs) {
          const result = await this.handleJobDailyCheckLink(job);
          if (result) await this.deleteJobInDb(job?._id); // Delete job if index success
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    } finally {
      this.lockService.unlockDailyCheckLink7();
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'daily-check-link-8',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerDailyCheckLink8() {
    await this.handleCronDailyCheckLink8();
  }
  async handleCronDailyCheckLink8(): Promise<void> {
    if (this.lockService.isLockedDailyCheckLink8()) {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        'Action -> Cron Start Daily Check Link 8',
      );
      return;
    }
    this.lockService.lockDailyCheckLink8();
    try {
      const jobs: any = await this.jobModel
        .find({
          status: JOB_STATUS.WAITING,
          type: JOB_TYPE.DAILY,
          numberOfLoop: 8,
        })
        .limit(50)
        .lean();

      if (jobs && jobs.length) {
        for (const job of jobs) {
          const result = await this.handleJobDailyCheckLink(job);
          if (result) await this.deleteJobInDb(job?._id); // Delete job if index success
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    } finally {
      this.lockService.unlockDailyCheckLink8();
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'daily-check-link-9',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerDailyCheckLink9() {
    await this.handleCronDailyCheckLink9();
  }
  async handleCronDailyCheckLink9(): Promise<void> {
    if (this.lockService.isLockedDailyCheckLink9()) {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        'Action -> Cron Start Daily Check Link 9',
      );
      return;
    }
    this.lockService.lockDailyCheckLink9();
    try {
      const jobs: any = await this.jobModel
        .find({
          status: JOB_STATUS.WAITING,
          type: JOB_TYPE.DAILY,
          numberOfLoop: 9,
        })
        .limit(50)
        .lean();

      if (jobs && jobs.length) {
        for (const job of jobs) {
          const result = await this.handleJobDailyCheckLink(job);
          if (result) await this.deleteJobInDb(job?._id); // Delete job if index success
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    } finally {
      this.lockService.unlockDailyCheckLink9();
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'daily-check-link-10',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerDailyCheckLink10() {
    await this.handleCronDailyCheckLink10();
  }
  async handleCronDailyCheckLink10(): Promise<void> {
    if (this.lockService.isLockedDailyCheckLink10()) {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        'Action -> Cron Start Daily Check Link 10',
      );
      return;
    }
    this.lockService.lockDailyCheckLink10();
    try {
      const jobs: any = await this.jobModel
        .find({
          status: JOB_STATUS.WAITING,
          type: JOB_TYPE.DAILY,
          numberOfLoop: 10,
        })
        .limit(50)
        .lean();

      if (jobs && jobs.length) {
        for (const job of jobs) {
          const result = await this.handleJobDailyCheckLink(job);
          if (result) await this.deleteJobInDb(job?._id); // Delete job if index success
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    } finally {
      this.lockService.unlockDailyCheckLink10();
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'daily-check-link-11',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerDailyCheckLink11() {
    await this.handleCronDailyCheckLink11();
  }
  async handleCronDailyCheckLink11(): Promise<void> {
    if (this.lockService.isLockedDailyCheckLink11()) {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        'Action -> Cron Start Daily Check Link 11',
      );
      return;
    }
    this.lockService.lockDailyCheckLink11();
    try {
      const jobs: any = await this.jobModel
        .find({
          status: JOB_STATUS.WAITING,
          type: JOB_TYPE.DAILY,
          numberOfLoop: 11,
        })
        .limit(50)
        .lean();

      if (jobs && jobs.length) {
        for (const job of jobs) {
          const result = await this.handleJobDailyCheckLink(job);
          if (result) await this.deleteJobInDb(job?._id); // Delete job if index success
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    } finally {
      this.lockService.unlockDailyCheckLink11();
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'daily-check-link-12',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerDailyCheckLink12() {
    await this.handleCronDailyCheckLink12();
  }
  async handleCronDailyCheckLink12(): Promise<void> {
    if (this.lockService.isLockedDailyCheckLink12()) {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        'Action -> Cron Start Daily Check Link 12',
      );
      return;
    }
    this.lockService.lockDailyCheckLink12();
    try {
      const jobs: any = await this.jobModel
        .find({
          status: JOB_STATUS.WAITING,
          type: JOB_TYPE.DAILY,
          numberOfLoop: 12,
        })
        .limit(50)
        .lean();

      if (jobs && jobs.length) {
        for (const job of jobs) {
          const result = await this.handleJobDailyCheckLink(job);
          if (result) await this.deleteJobInDb(job?._id); // Delete job if index success
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    } finally {
      this.lockService.unlockDailyCheckLink12();
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'daily-check-link-13',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerDailyCheckLink13() {
    await this.handleCronDailyCheckLink13();
  }
  async handleCronDailyCheckLink13(): Promise<void> {
    if (this.lockService.isLockedDailyCheckLink13()) {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        'Action -> Cron Start Daily Check Link 13',
      );
      return;
    }
    this.lockService.lockDailyCheckLink13();
    try {
      const jobs: any = await this.jobModel
        .find({
          status: JOB_STATUS.WAITING,
          type: JOB_TYPE.DAILY,
          numberOfLoop: 13,
        })
        .limit(50)
        .lean();

      if (jobs && jobs.length) {
        for (const job of jobs) {
          const result = await this.handleJobDailyCheckLink(job);
          if (result) await this.deleteJobInDb(job?._id); // Delete job if index success
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    } finally {
      this.lockService.unlockDailyCheckLink13();
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'daily-check-link-14',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerDailyCheckLink14() {
    await this.handleCronDailyCheckLink14();
  }
  async handleCronDailyCheckLink14(): Promise<void> {
    if (this.lockService.isLockedDailyCheckLink14()) {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        'Action -> Cron Start Daily Check Link 14',
      );
      return;
    }
    this.lockService.lockDailyCheckLink14();
    try {
      const jobs: any = await this.jobModel
        .find({
          status: JOB_STATUS.WAITING,
          type: JOB_TYPE.DAILY,
          numberOfLoop: 14,
        })
        .limit(50)
        .lean();

      if (jobs && jobs.length) {
        for (const job of jobs) {
          const result = await this.handleJobDailyCheckLink(job);
          if (result) await this.deleteJobInDb(job?._id); // Delete job if index success
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    } finally {
      this.lockService.unlockDailyCheckLink14();
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'daily-check-link-15',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerDailyCheckLink15() {
    await this.handleCronDailyCheckLink15();
  }
  async handleCronDailyCheckLink15(): Promise<void> {
    if (this.lockService.isLockedDailyCheckLink15()) {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        'Action -> Cron Start Daily Check Link 15',
      );
      return;
    }
    this.lockService.lockDailyCheckLink15();
    try {
      const jobs: any = await this.jobModel
        .find({
          status: JOB_STATUS.WAITING,
          type: JOB_TYPE.DAILY,
          numberOfLoop: 15,
        })
        .limit(50)
        .lean();

      if (jobs && jobs.length) {
        for (const job of jobs) {
          const result = await this.handleJobDailyCheckLink(job);
          if (result) await this.deleteJobInDb(job?._id); // Delete job if index success
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    } finally {
      this.lockService.unlockDailyCheckLink15();
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'daily-check-link-16',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerDailyCheckLink16() {
    await this.handleCronDailyCheckLink16();
  }
  async handleCronDailyCheckLink16(): Promise<void> {
    if (this.lockService.isLockedDailyCheckLink16()) {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        'Action -> Cron Start Daily Check Link 16',
      );
      return;
    }
    this.lockService.lockDailyCheckLink16();
    try {
      const jobs: any = await this.jobModel
        .find({
          status: JOB_STATUS.WAITING,
          type: JOB_TYPE.DAILY,
          numberOfLoop: 16,
        })
        .limit(50)
        .lean();

      if (jobs && jobs.length) {
        for (const job of jobs) {
          const result = await this.handleJobDailyCheckLink(job);
          if (result) await this.deleteJobInDb(job?._id); // Delete job if index success
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    } finally {
      this.lockService.unlockDailyCheckLink16();
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'daily-check-link-17',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerDailyCheckLink17() {
    await this.handleCronDailyCheckLink17();
  }
  async handleCronDailyCheckLink17(): Promise<void> {
    if (this.lockService.isLockedDailyCheckLink17()) {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        'Action -> Cron Start Daily Check Link 17',
      );
      return;
    }
    this.lockService.lockDailyCheckLink17();
    try {
      const jobs: any = await this.jobModel
        .find({
          status: JOB_STATUS.WAITING,
          type: JOB_TYPE.DAILY,
          numberOfLoop: 17,
        })
        .limit(50)
        .lean();

      if (jobs && jobs.length) {
        for (const job of jobs) {
          const result = await this.handleJobDailyCheckLink(job);
          if (result) await this.deleteJobInDb(job?._id); // Delete job if index success
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    } finally {
      this.lockService.unlockDailyCheckLink17();
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'daily-check-link-18',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerDailyCheckLink18() {
    await this.handleCronDailyCheckLink18();
  }
  async handleCronDailyCheckLink18(): Promise<void> {
    if (this.lockService.isLockedDailyCheckLink18()) {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        'Action -> Cron Start Daily Check Link 18',
      );
      return;
    }
    this.lockService.lockDailyCheckLink18();
    try {
      const jobs: any = await this.jobModel
        .find({
          status: JOB_STATUS.WAITING,
          type: JOB_TYPE.DAILY,
          numberOfLoop: 18,
        })
        .limit(50)
        .lean();

      if (jobs && jobs.length) {
        for (const job of jobs) {
          const result = await this.handleJobDailyCheckLink(job);
          if (result) await this.deleteJobInDb(job?._id); // Delete job if index success
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    } finally {
      this.lockService.unlockDailyCheckLink18();
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'daily-check-link-19',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerDailyCheckLink19() {
    await this.handleCronDailyCheckLink19();
  }
  async handleCronDailyCheckLink19(): Promise<void> {
    if (this.lockService.isLockedDailyCheckLink19()) {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        'Action -> Cron Start Daily Check Link 19',
      );
      return;
    }
    this.lockService.lockDailyCheckLink19();
    try {
      const jobs: any = await this.jobModel
        .find({
          status: JOB_STATUS.WAITING,
          type: JOB_TYPE.DAILY,
          numberOfLoop: 19,
        })
        .limit(50)
        .lean();

      if (jobs && jobs.length) {
        for (const job of jobs) {
          const result = await this.handleJobDailyCheckLink(job);
          if (result) await this.deleteJobInDb(job?._id); // Delete job if index success
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    } finally {
      this.lockService.unlockDailyCheckLink19();
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'daily-check-link-20',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerDailyCheckLink20() {
    await this.handleCronDailyCheckLink20();
  }
  async handleCronDailyCheckLink20(): Promise<void> {
    if (this.lockService.isLockedDailyCheckLink20()) {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        'Action -> Cron Start Daily Check Link 20',
      );
      return;
    }
    this.lockService.lockDailyCheckLink20();
    try {
      const jobs: any = await this.jobModel
        .find({
          status: JOB_STATUS.WAITING,
          type: JOB_TYPE.DAILY,
          numberOfLoop: 20,
        })
        .limit(50)
        .lean();

      if (jobs && jobs.length) {
        for (const job of jobs) {
          const result = await this.handleJobDailyCheckLink(job);
          if (result) await this.deleteJobInDb(job?._id); // Delete job if index success
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    } finally {
      this.lockService.unlockDailyCheckLink20();
    }
  }

  async handleCronCheckLink(cron): Promise<void> {
    if (this.lockService.isLockedCheckLink(cron)) {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        `Action -> Cron Start Check Link ${cron}`,
      );
      return;
    }
    this.lockService.lockCheckLink(cron);
    try {
      const jobs: any = await this.jobModel
        .find({
          status: JOB_STATUS.WAITING,
          type: JOB_TYPE.CHECK_LINK,
          numberOfLoop: cron,
        })
        .limit(50)
        .lean();

      if (jobs && jobs.length) {
        for (const job of jobs) {
          const result = await this.handleJobCheckLink(job);
          if (result) await this.deleteJobInDb(job?._id);
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    } finally {
      this.lockService.unlockCheckLink(cron);
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-1',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink1() {
    await this.handleCronCheckLink(1);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-2',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink2() {
    await this.handleCronCheckLink(2);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-3',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink3() {
    await this.handleCronCheckLink(3);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-4',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink4() {
    await this.handleCronCheckLink(4);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-5',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink5() {
    await this.handleCronCheckLink(5);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-6',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink6() {
    await this.handleCronCheckLink(6);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-7',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink7() {
    await this.handleCronCheckLink(7);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-8',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink8() {
    await this.handleCronCheckLink(8);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-9',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink9() {
    await this.handleCronCheckLink(9);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-10',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink10() {
    await this.handleCronCheckLink(10);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-11',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink11() {
    await this.handleCronCheckLink(11);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-12',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink12() {
    await this.handleCronCheckLink(12);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-13',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink13() {
    await this.handleCronCheckLink(13);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-14',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink14() {
    await this.handleCronCheckLink(14);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-15',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink15() {
    await this.handleCronCheckLink(15);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-16',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink16() {
    await this.handleCronCheckLink(16);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-17',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink17() {
    await this.handleCronCheckLink(17);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-18',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink18() {
    await this.handleCronCheckLink(18);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-19',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink19() {
    await this.handleCronCheckLink(19);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-20',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink20() {
    await this.handleCronCheckLink(20);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-21',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink21() {
    await this.handleCronCheckLink(21);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-22',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink22() {
    await this.handleCronCheckLink(22);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-23',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink23() {
    await this.handleCronCheckLink(23);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-24',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink24() {
    await this.handleCronCheckLink(24);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-25',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink25() {
    await this.handleCronCheckLink(25);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-26',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink26() {
    await this.handleCronCheckLink(26);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-27',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink27() {
    await this.handleCronCheckLink(27);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-28',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink28() {
    await this.handleCronCheckLink(28);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-29',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink29() {
    await this.handleCronCheckLink(29);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-30',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink30() {
    await this.handleCronCheckLink(30);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-31',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink31() {
    await this.handleCronCheckLink(31);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-32',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink32() {
    await this.handleCronCheckLink(32);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-33',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink33() {
    await this.handleCronCheckLink(33);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-34',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink34() {
    await this.handleCronCheckLink(34);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-35',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink35() {
    await this.handleCronCheckLink(35);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-36',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink36() {
    await this.handleCronCheckLink(36);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-37',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink37() {
    await this.handleCronCheckLink(37);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-38',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink38() {
    await this.handleCronCheckLink(38);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-39',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink39() {
    await this.handleCronCheckLink(39);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-40',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink40() {
    await this.handleCronCheckLink(40);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-41',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink41() {
    await this.handleCronCheckLink(41);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-42',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink42() {
    await this.handleCronCheckLink(42);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-43',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink43() {
    await this.handleCronCheckLink(43);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-44',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink44() {
    await this.handleCronCheckLink(44);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-45',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink45() {
    await this.handleCronCheckLink(45);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-46',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink46() {
    await this.handleCronCheckLink(46);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-47',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink47() {
    await this.handleCronCheckLink(47);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-48',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink48() {
    await this.handleCronCheckLink(48);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-49',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink49() {
    await this.handleCronCheckLink(49);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-50',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink50() {
    await this.handleCronCheckLink(50);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-51',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink51() {
    await this.handleCronCheckLink(51);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-52',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink52() {
    await this.handleCronCheckLink(52);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-53',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink53() {
    await this.handleCronCheckLink(53);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-54',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink54() {
    await this.handleCronCheckLink(54);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-55',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink55() {
    await this.handleCronCheckLink(55);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-56',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink56() {
    await this.handleCronCheckLink(56);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-57',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink57() {
    await this.handleCronCheckLink(57);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-58',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink58() {
    await this.handleCronCheckLink(58);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-59',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink59() {
    await this.handleCronCheckLink(59);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-60',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink60() {
    await this.handleCronCheckLink(60);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-61',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink61() {
    await this.handleCronCheckLink(61);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-62',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink62() {
    await this.handleCronCheckLink(62);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-63',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink63() {
    await this.handleCronCheckLink(63);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-64',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink64() {
    await this.handleCronCheckLink(64);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-65',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink65() {
    await this.handleCronCheckLink(65);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-66',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink66() {
    await this.handleCronCheckLink(66);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-67',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink67() {
    await this.handleCronCheckLink(67);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-68',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink68() {
    await this.handleCronCheckLink(68);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-69',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink69() {
    await this.handleCronCheckLink(69);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-70',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink70() {
    await this.handleCronCheckLink(70);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-71',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink71() {
    await this.handleCronCheckLink(71);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-72',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink72() {
    await this.handleCronCheckLink(72);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-73',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink73() {
    await this.handleCronCheckLink(73);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-74',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink74() {
    await this.handleCronCheckLink(74);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-75',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink75() {
    await this.handleCronCheckLink(75);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-76',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink76() {
    await this.handleCronCheckLink(76);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-77',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink77() {
    await this.handleCronCheckLink(77);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-78',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink78() {
    await this.handleCronCheckLink(78);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-79',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink79() {
    await this.handleCronCheckLink(79);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-80',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink80() {
    await this.handleCronCheckLink(80);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-81',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink81() {
    await this.handleCronCheckLink(81);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-82',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink82() {
    await this.handleCronCheckLink(82);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-83',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink83() {
    await this.handleCronCheckLink(83);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-84',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink84() {
    await this.handleCronCheckLink(84);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-85',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink85() {
    await this.handleCronCheckLink(85);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-86',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink86() {
    await this.handleCronCheckLink(86);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-87',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink87() {
    await this.handleCronCheckLink(87);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-88',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink88() {
    await this.handleCronCheckLink(88);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-89',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink89() {
    await this.handleCronCheckLink(89);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-90',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink90() {
    await this.handleCronCheckLink(90);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-91',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink91() {
    await this.handleCronCheckLink(91);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-92',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink92() {
    await this.handleCronCheckLink(92);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-93',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink93() {
    await this.handleCronCheckLink(93);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-94',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink94() {
    await this.handleCronCheckLink(94);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-95',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink95() {
    await this.handleCronCheckLink(95);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-96',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink96() {
    await this.handleCronCheckLink(96);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-97',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink97() {
    await this.handleCronCheckLink(97);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-98',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink98() {
    await this.handleCronCheckLink(98);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-99',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink99() {
    await this.handleCronCheckLink(99);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-100',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink100() {
    await this.handleCronCheckLink(100);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-101',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink101() {
    await this.handleCronCheckLink(101);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-102',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink102() {
    await this.handleCronCheckLink(102);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-103',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink103() {
    await this.handleCronCheckLink(103);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-104',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink104() {
    await this.handleCronCheckLink(104);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-105',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink105() {
    await this.handleCronCheckLink(105);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-106',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink106() {
    await this.handleCronCheckLink(106);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-107',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink107() {
    await this.handleCronCheckLink(107);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-108',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink108() {
    await this.handleCronCheckLink(108);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-109',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink109() {
    await this.handleCronCheckLink(109);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-110',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink110() {
    await this.handleCronCheckLink(110);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-111',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink111() {
    await this.handleCronCheckLink(111);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-112',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink112() {
    await this.handleCronCheckLink(112);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-113',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink113() {
    await this.handleCronCheckLink(113);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-114',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink114() {
    await this.handleCronCheckLink(114);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-115',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink115() {
    await this.handleCronCheckLink(115);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-116',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink116() {
    await this.handleCronCheckLink(116);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-117',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink117() {
    await this.handleCronCheckLink(117);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-118',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink118() {
    await this.handleCronCheckLink(118);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-119',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink119() {
    await this.handleCronCheckLink(119);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-120',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink120() {
    await this.handleCronCheckLink(120);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-121',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink121() {
    await this.handleCronCheckLink(121);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-122',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink122() {
    await this.handleCronCheckLink(122);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-123',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink123() {
    await this.handleCronCheckLink(123);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-124',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink124() {
    await this.handleCronCheckLink(124);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-125',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink125() {
    await this.handleCronCheckLink(125);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-126',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink126() {
    await this.handleCronCheckLink(126);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-127',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink127() {
    await this.handleCronCheckLink(127);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-128',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink128() {
    await this.handleCronCheckLink(128);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-129',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink129() {
    await this.handleCronCheckLink(129);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-130',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink130() {
    await this.handleCronCheckLink(130);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-131',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink131() {
    await this.handleCronCheckLink(131);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-132',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink132() {
    await this.handleCronCheckLink(132);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-133',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink133() {
    await this.handleCronCheckLink(133);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-134',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink134() {
    await this.handleCronCheckLink(134);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-135',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink135() {
    await this.handleCronCheckLink(135);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-136',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink136() {
    await this.handleCronCheckLink(136);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-137',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink137() {
    await this.handleCronCheckLink(137);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-138',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink138() {
    await this.handleCronCheckLink(138);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-139',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink139() {
    await this.handleCronCheckLink(139);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-140',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink140() {
    await this.handleCronCheckLink(140);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-141',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink141() {
    await this.handleCronCheckLink(141);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-142',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink142() {
    await this.handleCronCheckLink(142);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-143',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink143() {
    await this.handleCronCheckLink(143);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-144',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink144() {
    await this.handleCronCheckLink(144);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-145',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink145() {
    await this.handleCronCheckLink(145);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-146',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink146() {
    await this.handleCronCheckLink(146);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-147',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink147() {
    await this.handleCronCheckLink(147);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-148',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink148() {
    await this.handleCronCheckLink(148);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-149',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink149() {
    await this.handleCronCheckLink(149);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-150',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink150() {
    await this.handleCronCheckLink(150);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-151',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink151() {
    await this.handleCronCheckLink(151);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-152',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink152() {
    await this.handleCronCheckLink(152);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-153',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink153() {
    await this.handleCronCheckLink(153);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-154',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink154() {
    await this.handleCronCheckLink(154);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-155',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink155() {
    await this.handleCronCheckLink(155);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-156',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink156() {
    await this.handleCronCheckLink(156);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-157',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink157() {
    await this.handleCronCheckLink(157);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-158',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink158() {
    await this.handleCronCheckLink(158);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-159',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink159() {
    await this.handleCronCheckLink(159);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-160',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink160() {
    await this.handleCronCheckLink(160);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-161',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink161() {
    await this.handleCronCheckLink(161);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-162',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink162() {
    await this.handleCronCheckLink(162);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-163',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink163() {
    await this.handleCronCheckLink(163);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-164',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink164() {
    await this.handleCronCheckLink(164);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-165',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink165() {
    await this.handleCronCheckLink(165);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-166',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink166() {
    await this.handleCronCheckLink(166);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-167',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink167() {
    await this.handleCronCheckLink(167);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-168',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink168() {
    await this.handleCronCheckLink(168);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-169',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink169() {
    await this.handleCronCheckLink(169);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-170',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink170() {
    await this.handleCronCheckLink(170);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-171',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink171() {
    await this.handleCronCheckLink(171);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-172',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink172() {
    await this.handleCronCheckLink(172);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-173',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink173() {
    await this.handleCronCheckLink(173);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-174',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink174() {
    await this.handleCronCheckLink(174);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-175',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink175() {
    await this.handleCronCheckLink(175);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-176',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink176() {
    await this.handleCronCheckLink(176);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-177',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink177() {
    await this.handleCronCheckLink(177);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-178',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink178() {
    await this.handleCronCheckLink(178);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-179',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink179() {
    await this.handleCronCheckLink(179);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-180',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink180() {
    await this.handleCronCheckLink(180);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-181',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink181() {
    await this.handleCronCheckLink(181);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-182',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink182() {
    await this.handleCronCheckLink(182);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-183',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink183() {
    await this.handleCronCheckLink(183);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-184',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink184() {
    await this.handleCronCheckLink(184);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-185',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink185() {
    await this.handleCronCheckLink(185);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-186',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink186() {
    await this.handleCronCheckLink(186);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-187',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink187() {
    await this.handleCronCheckLink(187);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-188',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink188() {
    await this.handleCronCheckLink(188);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-189',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink189() {
    await this.handleCronCheckLink(189);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-190',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink190() {
    await this.handleCronCheckLink(190);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-191',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink191() {
    await this.handleCronCheckLink(191);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-192',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink192() {
    await this.handleCronCheckLink(192);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-193',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink193() {
    await this.handleCronCheckLink(193);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-194',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink194() {
    await this.handleCronCheckLink(194);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-195',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink195() {
    await this.handleCronCheckLink(195);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-196',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink196() {
    await this.handleCronCheckLink(196);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-197',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink197() {
    await this.handleCronCheckLink(197);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-198',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink198() {
    await this.handleCronCheckLink(198);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-199',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink199() {
    await this.handleCronCheckLink(199);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-200',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink200() {
    await this.handleCronCheckLink(200);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-201',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink201() {
    await this.handleCronCheckLink(201);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-202',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink202() {
    await this.handleCronCheckLink(202);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-203',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink203() {
    await this.handleCronCheckLink(203);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-204',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink204() {
    await this.handleCronCheckLink(204);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-205',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink205() {
    await this.handleCronCheckLink(205);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-206',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink206() {
    await this.handleCronCheckLink(206);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-207',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink207() {
    await this.handleCronCheckLink(207);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-208',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink208() {
    await this.handleCronCheckLink(208);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-209',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink209() {
    await this.handleCronCheckLink(209);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-210',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink210() {
    await this.handleCronCheckLink(210);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-211',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink211() {
    await this.handleCronCheckLink(211);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-212',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink212() {
    await this.handleCronCheckLink(212);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-213',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink213() {
    await this.handleCronCheckLink(213);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-214',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink214() {
    await this.handleCronCheckLink(214);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-215',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink215() {
    await this.handleCronCheckLink(215);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-216',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink216() {
    await this.handleCronCheckLink(216);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-217',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink217() {
    await this.handleCronCheckLink(217);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-218',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink218() {
    await this.handleCronCheckLink(218);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-219',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink219() {
    await this.handleCronCheckLink(219);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-220',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink220() {
    await this.handleCronCheckLink(220);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-221',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink221() {
    await this.handleCronCheckLink(221);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-222',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink222() {
    await this.handleCronCheckLink(222);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-223',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink223() {
    await this.handleCronCheckLink(223);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-224',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink224() {
    await this.handleCronCheckLink(224);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-225',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink225() {
    await this.handleCronCheckLink(225);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-226',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink226() {
    await this.handleCronCheckLink(226);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-227',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink227() {
    await this.handleCronCheckLink(227);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-228',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink228() {
    await this.handleCronCheckLink(228);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-229',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink229() {
    await this.handleCronCheckLink(229);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-230',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink230() {
    await this.handleCronCheckLink(230);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-231',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink231() {
    await this.handleCronCheckLink(231);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-232',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink232() {
    await this.handleCronCheckLink(232);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-233',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink233() {
    await this.handleCronCheckLink(233);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-234',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink234() {
    await this.handleCronCheckLink(234);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-235',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink235() {
    await this.handleCronCheckLink(235);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-236',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink236() {
    await this.handleCronCheckLink(236);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-237',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink237() {
    await this.handleCronCheckLink(237);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-238',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink238() {
    await this.handleCronCheckLink(238);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-239',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink239() {
    await this.handleCronCheckLink(239);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-240',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink240() {
    await this.handleCronCheckLink(240);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-241',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink241() {
    await this.handleCronCheckLink(241);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-242',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink242() {
    await this.handleCronCheckLink(242);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-243',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink243() {
    await this.handleCronCheckLink(243);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-244',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink244() {
    await this.handleCronCheckLink(244);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-245',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink245() {
    await this.handleCronCheckLink(245);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-246',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink246() {
    await this.handleCronCheckLink(246);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-247',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink247() {
    await this.handleCronCheckLink(247);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-248',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink248() {
    await this.handleCronCheckLink(248);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-249',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink249() {
    await this.handleCronCheckLink(249);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-250',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink250() {
    await this.handleCronCheckLink(250);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-251',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink251() {
    await this.handleCronCheckLink(251);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-252',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink252() {
    await this.handleCronCheckLink(252);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-253',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink253() {
    await this.handleCronCheckLink(253);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-254',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink254() {
    await this.handleCronCheckLink(254);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-255',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink255() {
    await this.handleCronCheckLink(255);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-256',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink256() {
    await this.handleCronCheckLink(256);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-257',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink257() {
    await this.handleCronCheckLink(257);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-258',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink258() {
    await this.handleCronCheckLink(258);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-259',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink259() {
    await this.handleCronCheckLink(259);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-260',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink260() {
    await this.handleCronCheckLink(260);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-261',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink261() {
    await this.handleCronCheckLink(261);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-262',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink262() {
    await this.handleCronCheckLink(262);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-263',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink263() {
    await this.handleCronCheckLink(263);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-264',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink264() {
    await this.handleCronCheckLink(264);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-265',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink265() {
    await this.handleCronCheckLink(265);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-266',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink266() {
    await this.handleCronCheckLink(266);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-267',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink267() {
    await this.handleCronCheckLink(267);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-268',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink268() {
    await this.handleCronCheckLink(268);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-269',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink269() {
    await this.handleCronCheckLink(269);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-270',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink270() {
    await this.handleCronCheckLink(270);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-271',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink271() {
    await this.handleCronCheckLink(271);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-272',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink272() {
    await this.handleCronCheckLink(272);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-273',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink273() {
    await this.handleCronCheckLink(273);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-274',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink274() {
    await this.handleCronCheckLink(274);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-275',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink275() {
    await this.handleCronCheckLink(275);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-276',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink276() {
    await this.handleCronCheckLink(276);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-277',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink277() {
    await this.handleCronCheckLink(277);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-278',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink278() {
    await this.handleCronCheckLink(278);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-279',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink279() {
    await this.handleCronCheckLink(279);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-280',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink280() {
    await this.handleCronCheckLink(280);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-281',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink281() {
    await this.handleCronCheckLink(281);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-282',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink282() {
    await this.handleCronCheckLink(282);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-283',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink283() {
    await this.handleCronCheckLink(283);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-284',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink284() {
    await this.handleCronCheckLink(284);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-285',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink285() {
    await this.handleCronCheckLink(285);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-286',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink286() {
    await this.handleCronCheckLink(286);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-287',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink287() {
    await this.handleCronCheckLink(287);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-288',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink288() {
    await this.handleCronCheckLink(288);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-289',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink289() {
    await this.handleCronCheckLink(289);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-290',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink290() {
    await this.handleCronCheckLink(290);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-291',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink291() {
    await this.handleCronCheckLink(291);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-292',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink292() {
    await this.handleCronCheckLink(292);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-293',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink293() {
    await this.handleCronCheckLink(293);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-294',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink294() {
    await this.handleCronCheckLink(294);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-295',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink295() {
    await this.handleCronCheckLink(295);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-296',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink296() {
    await this.handleCronCheckLink(296);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-297',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink297() {
    await this.handleCronCheckLink(297);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-298',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink298() {
    await this.handleCronCheckLink(298);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-299',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink299() {
    await this.handleCronCheckLink(299);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-300',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLink300() {
    await this.handleCronCheckLink(300);
  }

  /**
   * handle check link index
   * cron -> handleCronCheckLinkIndex
   *
   * @param cron number
   * @returns Promise<void>
   */
  async handleCronCheckLinkIndex(cron: number): Promise<void> {
    if (this.jobLockCheckLinkIndexService.isLockedCheckLinkIndex(cron)) {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        `Action -> Cron Start Check Link Index ${cron}`,
      );
      return;
    }
    this.jobLockCheckLinkIndexService.lockCheckLinkIndex(cron);
    try {
      const jobs: any = await this.jobModel
        .find({
          status: JOB_STATUS.WAITING,
          type: JOB_TYPE.CHECK_LINK_INDEX,
          numberOfLoop: cron,
        })
        .limit(50)
        .lean();

      if (jobs && jobs.length) {
        for (const job of jobs) {
          const result = await this.handleJobCheckLinkIndex(job);
          if (result) await this.deleteJobInDb(job?._id);
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    } finally {
      this.jobLockCheckLinkIndexService.unlockCheckLinkIndex(cron);
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-1',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex1() {
    await this.handleCronCheckLinkIndex(1);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-2',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex2() {
    await this.handleCronCheckLinkIndex(2);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-3',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex3() {
    await this.handleCronCheckLinkIndex(3);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-4',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex4() {
    await this.handleCronCheckLinkIndex(4);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-5',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex5() {
    await this.handleCronCheckLinkIndex(5);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-6',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex6() {
    await this.handleCronCheckLinkIndex(6);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-7',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex7() {
    await this.handleCronCheckLinkIndex(7);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-8',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex8() {
    await this.handleCronCheckLinkIndex(8);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-9',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex9() {
    await this.handleCronCheckLinkIndex(9);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-10',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex10() {
    await this.handleCronCheckLinkIndex(10);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-11',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex11() {
    await this.handleCronCheckLinkIndex(11);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-12',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex12() {
    await this.handleCronCheckLinkIndex(12);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-13',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex13() {
    await this.handleCronCheckLinkIndex(13);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-14',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex14() {
    await this.handleCronCheckLinkIndex(14);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-15',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex15() {
    await this.handleCronCheckLinkIndex(15);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-16',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex16() {
    await this.handleCronCheckLinkIndex(16);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-17',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex17() {
    await this.handleCronCheckLinkIndex(17);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-18',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex18() {
    await this.handleCronCheckLinkIndex(18);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-19',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex19() {
    await this.handleCronCheckLinkIndex(19);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-20',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex20() {
    await this.handleCronCheckLinkIndex(20);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-21',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex21() {
    await this.handleCronCheckLinkIndex(21);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-22',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex22() {
    await this.handleCronCheckLinkIndex(22);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-23',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex23() {
    await this.handleCronCheckLinkIndex(23);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-24',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex24() {
    await this.handleCronCheckLinkIndex(24);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-25',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex25() {
    await this.handleCronCheckLinkIndex(25);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-26',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex26() {
    await this.handleCronCheckLinkIndex(26);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-27',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex27() {
    await this.handleCronCheckLinkIndex(27);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-28',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex28() {
    await this.handleCronCheckLinkIndex(28);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-29',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex29() {
    await this.handleCronCheckLinkIndex(29);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-30',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex30() {
    await this.handleCronCheckLinkIndex(30);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-31',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex31() {
    await this.handleCronCheckLinkIndex(31);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-32',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex32() {
    await this.handleCronCheckLinkIndex(32);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-33',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex33() {
    await this.handleCronCheckLinkIndex(33);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-34',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex34() {
    await this.handleCronCheckLinkIndex(34);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-35',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex35() {
    await this.handleCronCheckLinkIndex(35);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-36',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex36() {
    await this.handleCronCheckLinkIndex(36);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-37',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex37() {
    await this.handleCronCheckLinkIndex(37);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-38',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex38() {
    await this.handleCronCheckLinkIndex(38);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-39',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex39() {
    await this.handleCronCheckLinkIndex(39);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-40',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex40() {
    await this.handleCronCheckLinkIndex(40);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-41',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex41() {
    await this.handleCronCheckLinkIndex(41);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-42',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex42() {
    await this.handleCronCheckLinkIndex(42);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-43',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex43() {
    await this.handleCronCheckLinkIndex(43);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-44',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex44() {
    await this.handleCronCheckLinkIndex(44);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-45',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex45() {
    await this.handleCronCheckLinkIndex(45);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-46',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex46() {
    await this.handleCronCheckLinkIndex(46);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-47',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex47() {
    await this.handleCronCheckLinkIndex(47);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-48',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex48() {
    await this.handleCronCheckLinkIndex(48);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-49',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex49() {
    await this.handleCronCheckLinkIndex(49);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-50',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex50() {
    await this.handleCronCheckLinkIndex(50);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-51',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex51() {
    await this.handleCronCheckLinkIndex(51);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-52',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex52() {
    await this.handleCronCheckLinkIndex(52);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-53',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex53() {
    await this.handleCronCheckLinkIndex(53);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-54',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex54() {
    await this.handleCronCheckLinkIndex(54);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-55',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex55() {
    await this.handleCronCheckLinkIndex(55);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-56',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex56() {
    await this.handleCronCheckLinkIndex(56);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-57',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex57() {
    await this.handleCronCheckLinkIndex(57);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-58',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex58() {
    await this.handleCronCheckLinkIndex(58);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-59',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex59() {
    await this.handleCronCheckLinkIndex(59);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-60',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex60() {
    await this.handleCronCheckLinkIndex(60);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-61',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex61() {
    await this.handleCronCheckLinkIndex(61);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-62',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex62() {
    await this.handleCronCheckLinkIndex(62);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-63',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex63() {
    await this.handleCronCheckLinkIndex(63);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-64',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex64() {
    await this.handleCronCheckLinkIndex(64);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-65',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex65() {
    await this.handleCronCheckLinkIndex(65);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-66',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex66() {
    await this.handleCronCheckLinkIndex(66);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-67',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex67() {
    await this.handleCronCheckLinkIndex(67);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-68',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex68() {
    await this.handleCronCheckLinkIndex(68);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-69',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex69() {
    await this.handleCronCheckLinkIndex(69);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-70',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex70() {
    await this.handleCronCheckLinkIndex(70);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-71',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex71() {
    await this.handleCronCheckLinkIndex(71);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-72',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex72() {
    await this.handleCronCheckLinkIndex(72);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-73',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex73() {
    await this.handleCronCheckLinkIndex(73);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-74',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex74() {
    await this.handleCronCheckLinkIndex(74);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-75',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex75() {
    await this.handleCronCheckLinkIndex(75);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-76',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex76() {
    await this.handleCronCheckLinkIndex(76);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-77',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex77() {
    await this.handleCronCheckLinkIndex(77);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-78',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex78() {
    await this.handleCronCheckLinkIndex(78);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-79',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex79() {
    await this.handleCronCheckLinkIndex(79);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-80',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex80() {
    await this.handleCronCheckLinkIndex(80);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-81',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex81() {
    await this.handleCronCheckLinkIndex(81);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-82',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex82() {
    await this.handleCronCheckLinkIndex(82);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-83',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex83() {
    await this.handleCronCheckLinkIndex(83);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-84',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex84() {
    await this.handleCronCheckLinkIndex(84);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-85',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex85() {
    await this.handleCronCheckLinkIndex(85);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-86',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex86() {
    await this.handleCronCheckLinkIndex(86);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-87',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex87() {
    await this.handleCronCheckLinkIndex(87);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-88',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex88() {
    await this.handleCronCheckLinkIndex(88);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-89',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex89() {
    await this.handleCronCheckLinkIndex(89);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-90',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex90() {
    await this.handleCronCheckLinkIndex(90);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-91',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex91() {
    await this.handleCronCheckLinkIndex(91);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-92',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex92() {
    await this.handleCronCheckLinkIndex(92);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-93',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex93() {
    await this.handleCronCheckLinkIndex(93);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-94',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex94() {
    await this.handleCronCheckLinkIndex(94);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-95',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex95() {
    await this.handleCronCheckLinkIndex(95);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-96',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex96() {
    await this.handleCronCheckLinkIndex(96);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-97',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex97() {
    await this.handleCronCheckLinkIndex(97);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-98',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex98() {
    await this.handleCronCheckLinkIndex(98);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-99',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex99() {
    await this.handleCronCheckLinkIndex(99);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'check-link-index-100',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerCheckLinkIndex100() {
    await this.handleCronCheckLinkIndex(100);
  }

  /**
   * handle index link
   * cron -> handleJobIndexLink
   *
   * @param cron number
   * @returns Promise<void>
   */
  async handleCronIndexLink(cron: number): Promise<void> {
    if (this.jobLockIndexLinkService.isLockedIndexLink(cron)) {
      this.logger.debug(
        `Another instance is still processing records. Skipping this run.`,
        `Action -> Cron Start Index Link ${cron}`,
      );
      return;
    }
    this.jobLockIndexLinkService.lockIndexLink(cron);
    try {
      const jobs: any = await this.jobModel
        .find({
          status: JOB_STATUS.WAITING,
          type: JOB_TYPE.INDEX_LINK,
          numberOfLoop: cron,
        })
        .limit(50)
        .lean();

      if (jobs && jobs.length) {
        for (const job of jobs) {
          const result = await this.handleJobIndexLink(job);
          if (result) await this.deleteJobInDb(job?._id);
        }
      }
    } catch (e) {
      this.logger.error('JobService/ScheduleError', e);
    } finally {
      this.jobLockIndexLinkService.unlockIndexLink(cron);
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-1',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink1() {
    await this.handleCronIndexLink(1);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-2',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink2() {
    await this.handleCronIndexLink(2);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-3',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink3() {
    await this.handleCronIndexLink(3);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-4',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink4() {
    await this.handleCronIndexLink(4);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-5',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink5() {
    await this.handleCronIndexLink(5);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-6',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink6() {
    await this.handleCronIndexLink(6);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-7',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink7() {
    await this.handleCronIndexLink(7);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-8',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink8() {
    await this.handleCronIndexLink(8);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-9',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink9() {
    await this.handleCronIndexLink(9);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-10',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink10() {
    await this.handleCronIndexLink(10);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-11',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink11() {
    await this.handleCronIndexLink(11);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-12',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink12() {
    await this.handleCronIndexLink(12);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-13',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink13() {
    await this.handleCronIndexLink(13);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-14',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink14() {
    await this.handleCronIndexLink(14);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-15',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink15() {
    await this.handleCronIndexLink(15);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-16',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink16() {
    await this.handleCronIndexLink(16);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-17',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink17() {
    await this.handleCronIndexLink(17);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-18',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink18() {
    await this.handleCronIndexLink(18);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-19',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink19() {
    await this.handleCronIndexLink(19);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-20',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink20() {
    await this.handleCronIndexLink(20);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-21',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink21() {
    await this.handleCronIndexLink(21);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-22',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink22() {
    await this.handleCronIndexLink(22);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-23',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink23() {
    await this.handleCronIndexLink(23);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-24',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink24() {
    await this.handleCronIndexLink(24);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-25',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink25() {
    await this.handleCronIndexLink(25);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-26',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink26() {
    await this.handleCronIndexLink(26);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-27',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink27() {
    await this.handleCronIndexLink(27);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-28',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink28() {
    await this.handleCronIndexLink(28);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-29',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink29() {
    await this.handleCronIndexLink(29);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-30',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink30() {
    await this.handleCronIndexLink(30);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-31',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink31() {
    await this.handleCronIndexLink(31);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-32',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink32() {
    await this.handleCronIndexLink(32);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-33',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink33() {
    await this.handleCronIndexLink(33);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-34',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink34() {
    await this.handleCronIndexLink(34);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-35',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink35() {
    await this.handleCronIndexLink(35);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-36',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink36() {
    await this.handleCronIndexLink(36);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-37',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink37() {
    await this.handleCronIndexLink(37);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-38',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink38() {
    await this.handleCronIndexLink(38);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-39',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink39() {
    await this.handleCronIndexLink(39);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-40',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink40() {
    await this.handleCronIndexLink(40);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-41',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink41() {
    await this.handleCronIndexLink(41);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-42',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink42() {
    await this.handleCronIndexLink(42);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-43',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink43() {
    await this.handleCronIndexLink(43);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-44',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink44() {
    await this.handleCronIndexLink(44);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-45',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink45() {
    await this.handleCronIndexLink(45);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-46',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink46() {
    await this.handleCronIndexLink(46);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-47',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink47() {
    await this.handleCronIndexLink(47);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-48',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink48() {
    await this.handleCronIndexLink(48);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-49',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink49() {
    await this.handleCronIndexLink(49);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-50',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink50() {
    await this.handleCronIndexLink(50);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-51',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink51() {
    await this.handleCronIndexLink(51);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-52',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink52() {
    await this.handleCronIndexLink(52);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-53',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink53() {
    await this.handleCronIndexLink(53);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-54',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink54() {
    await this.handleCronIndexLink(54);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-55',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink55() {
    await this.handleCronIndexLink(55);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-56',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink56() {
    await this.handleCronIndexLink(56);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-57',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink57() {
    await this.handleCronIndexLink(57);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-58',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink58() {
    await this.handleCronIndexLink(58);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-59',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink59() {
    await this.handleCronIndexLink(59);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-60',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink60() {
    await this.handleCronIndexLink(60);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-61',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink61() {
    await this.handleCronIndexLink(61);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-62',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink62() {
    await this.handleCronIndexLink(62);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-63',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink63() {
    await this.handleCronIndexLink(63);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-64',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink64() {
    await this.handleCronIndexLink(64);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-65',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink65() {
    await this.handleCronIndexLink(65);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-66',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink66() {
    await this.handleCronIndexLink(66);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-67',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink67() {
    await this.handleCronIndexLink(67);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-68',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink68() {
    await this.handleCronIndexLink(68);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-69',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink69() {
    await this.handleCronIndexLink(69);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-70',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink70() {
    await this.handleCronIndexLink(70);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-71',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink71() {
    await this.handleCronIndexLink(71);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-72',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink72() {
    await this.handleCronIndexLink(72);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-73',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink73() {
    await this.handleCronIndexLink(73);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-74',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink74() {
    await this.handleCronIndexLink(74);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-75',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink75() {
    await this.handleCronIndexLink(75);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-76',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink76() {
    await this.handleCronIndexLink(76);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-77',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink77() {
    await this.handleCronIndexLink(77);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-78',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink78() {
    await this.handleCronIndexLink(78);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-79',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink79() {
    await this.handleCronIndexLink(79);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-80',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink80() {
    await this.handleCronIndexLink(80);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-81',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink81() {
    await this.handleCronIndexLink(81);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-82',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink82() {
    await this.handleCronIndexLink(82);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-83',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink83() {
    await this.handleCronIndexLink(83);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-84',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink84() {
    await this.handleCronIndexLink(84);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-85',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink85() {
    await this.handleCronIndexLink(85);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-86',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink86() {
    await this.handleCronIndexLink(86);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-87',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink87() {
    await this.handleCronIndexLink(87);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-88',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink88() {
    await this.handleCronIndexLink(88);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-89',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink89() {
    await this.handleCronIndexLink(89);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-90',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink90() {
    await this.handleCronIndexLink(90);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-91',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink91() {
    await this.handleCronIndexLink(91);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-92',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink92() {
    await this.handleCronIndexLink(92);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-93',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink93() {
    await this.handleCronIndexLink(93);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-94',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink94() {
    await this.handleCronIndexLink(94);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-95',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink95() {
    await this.handleCronIndexLink(95);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-96',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink96() {
    await this.handleCronIndexLink(96);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-97',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink97() {
    await this.handleCronIndexLink(97);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-98',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink98() {
    await this.handleCronIndexLink(98);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-99',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink99() {
    await this.handleCronIndexLink(99);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'index-link-100',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async triggerIndexLink100() {
    await this.handleCronIndexLink(100);
  }
}
