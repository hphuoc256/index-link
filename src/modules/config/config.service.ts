import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigRepositoryInterface } from '../../repositories/config.interface.repository';
import {
  MAX_NUMBER_OF_CHUNK_DEFAULT,
  MAX_NUMBER_OF_CHUNK_DEFAULT_CHECK_LINK_INDEX,
  MAX_NUMBER_OF_CHUNK_DEFAULT_INDEX_LINK,
  paginationQuery,
  splitArrayIntoChunks,
} from '../../utils';
import { Config } from '../../entities/config.entity';
import { UserService } from '../user/user.service';
import { toNumber } from 'lodash';
import { Model } from 'mongoose';
import { SuggestRepositoryInterface } from '../../repositories/suggest.interface.repository';
import {
  INDEX_LINK,
  JOB_STATUS,
  STATUS_LINK,
  TYPE_CONFIG,
} from '../../common/enum';
import { JobService } from '../job/job.service';
import { LinkRepositoryInterface } from '../../repositories/link.interface.repository';
import { InjectModel } from '@nestjs/mongoose';
import { Link } from '../../entities/link.entity';
import { ERROR_CODES } from '../../common/error-code';
import { WebsiteRepositoryInterface } from '../../repositories/website.interface.repository';
import { SinbyteRepositoryInterface } from '../../repositories/sinbyte.interface.repository';

@Injectable()
export class ConfigService {
  protected maxNumberOfChunks: number;
  constructor(
    @Inject('ConfigRepositoryInterface')
    private readonly configRepo: ConfigRepositoryInterface,
    private readonly userService: UserService,
    @Inject('SuggestRepositoryInterface')
    private readonly suggestRepo: SuggestRepositoryInterface,
    private readonly jobService: JobService,
    @Inject('LinkRepositoryInterface')
    private readonly linkRepo: LinkRepositoryInterface,
    @Inject('WebsiteRepositoryInterface')
    private readonly websiteRepo: WebsiteRepositoryInterface,
    @Inject('SinbyteRepositoryInterface')
    private readonly sinbyteRepo: SinbyteRepositoryInterface,
    @InjectModel(Link.name)
    private readonly linkModel: Model<Link>,
    @InjectModel(Config.name)
    private readonly configModel: Model<Config>,
  ) {
    this.maxNumberOfChunks = MAX_NUMBER_OF_CHUNK_DEFAULT;
  }
  async findAll(req) {
    try {
      const { limit, skip } = paginationQuery(req.query);
      const sort = { _id: -1 };
      if (req.query.sort === 'ASC') sort._id = 1;
      /*
       * GET CONFIG BY USER ID
       */
      const user = await this.userService.findOne(req.user.sub);
      let filterOption = {};
      if (user && user.roleId && user.roleId['code'] === 'user') {
        filterOption = {
          userId: user._id,
        };
      }
      const filter = { ...filterOption };
      if (req.query.search) {
        filter['$or'] = filter['$or'] || [];
        filter['$or'].push({
          name: new RegExp(req.query.search.toString(), 'i'),
        });
      }
      if (req.query.status) {
        filter['$or'] = filter['$or'] || [];
        filter['$or'].push({
          status: new RegExp(req.query.status.toString(), 'i'),
        });
      }

      const populateConfig = [
        { path: 'userId', select: 'name email' },
        { path: 'suggestId', select: 'name' },
      ];

      return await this.configRepo.findAll(filter, {
        limit,
        skip,
        sort,
        populate: populateConfig,
      });
    } catch (e) {
      throw e;
    }
  }

  async checkLink(createConfigDto, req): Promise<Config | any> {
    try {
      const suggest = await this.suggestRepo.findById(
        createConfigDto?.suggestId,
      );
      if (!suggest) {
        throw new HttpException(
          ERROR_CODES.SUGGEST_NOT_EXIST,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      await this.suggestRepo.update(suggest._id, {
        isChecked: true,
      });

      const payload = {
        userId: req.user.sub,
        suggestId: createConfigDto.suggestId,
        type: TYPE_CONFIG.CHECK_LINK,
      };

      const config = await this.configRepo.create(payload);

      if (config.type == TYPE_CONFIG.CHECK_LINK) {
        const findAllLinkInJobs = await this.jobService.findAll({
          type: TYPE_CONFIG.CHECK_LINK,
        });

        const linkIsStarted = findAllLinkInJobs.map((link) => {
          return link.linkId;
        });

        const linkByConfigs = await this.linkRepo.findBySuggestIds({
          suggestId: config.suggestId,
          _id: { $nin: linkIsStarted },
          status: { $ne: STATUS_LINK.SUCCESS },
        });

        if (linkByConfigs?.length) {
          const links = linkByConfigs.map((link) => {
            return {
              linkId: link._id,
              linkUrl: link.linkUrl,
              suggestId: config.suggestId,
              configId: config._id,
              type: TYPE_CONFIG.CHECK_LINK,
              status: JOB_STATUS.WAITING,
            };
          });

          const maxChunkSize = Math.ceil(links.length / this.maxNumberOfChunks);

          const chunkLinks = splitArrayIntoChunks(links, 0, maxChunkSize);

          for (const key in chunkLinks) {
            await this.jobService.createJobMany(chunkLinks[key]);
          }
        } else {
          await this.configRepo.deleteManyByCondition({
            _id: config._id,
          });
          throw new HttpException(
            ERROR_CODES.SUGGEST_MUST_HAVE_LINK,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
      }

      return config;
    } catch (e) {
      throw e;
    }
  }

  async checkLinkIndex(createConfigDto, req): Promise<Config | any> {
    try {
      const suggest = await this.suggestRepo.findById(
        createConfigDto?.suggestId,
      );
      if (!suggest) {
        throw new HttpException(
          ERROR_CODES.SUGGEST_NOT_EXIST,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      const payload = {
        userId: req.user.sub,
        suggestId: createConfigDto.suggestId,
        type: TYPE_CONFIG.CHECK_LINK_INDEX,
      };
      const config = await this.configRepo.create(payload);
      if (config.type == TYPE_CONFIG.CHECK_LINK_INDEX) {
        const findAllLinkInJobs = await this.jobService.findAll({
          type: TYPE_CONFIG.CHECK_LINK_INDEX,
        });

        const linkIsStarted = findAllLinkInJobs.map((link) => {
          return link.linkId;
        });

        const linkByConfigs = await this.linkRepo.findBySuggestIds({
          suggestId: config.suggestId,
          _id: { $nin: linkIsStarted },
        });

        if (linkByConfigs?.length) {
          const links = linkByConfigs.map((link) => {
            return {
              linkId: link._id,
              linkUrl: link.linkUrl,
              suggestId: config.suggestId,
              configId: config._id,
              type: TYPE_CONFIG.CHECK_LINK_INDEX,
              status: JOB_STATUS.WAITING,
            };
          });

          const maxChunkSize = Math.ceil(
            links.length / MAX_NUMBER_OF_CHUNK_DEFAULT_CHECK_LINK_INDEX,
          );

          const chunkLinks = splitArrayIntoChunks(links, 0, maxChunkSize);

          for (const key in chunkLinks) {
            await this.jobService.createJobMany(chunkLinks[key]);
          }
        } else {
          await this.configRepo.deleteManyByCondition({
            _id: config._id,
          });
          throw new HttpException(
            ERROR_CODES.SUGGEST_MUST_HAVE_LINK,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
      }
      return config;
    } catch (e) {
      throw e;
    }
  }

  async indexed(createConfigDto, req): Promise<Config | any> {
    try {
      const suggest = await this.suggestRepo.findById(
        createConfigDto?.suggestId,
      );
      if (!suggest) {
        throw new HttpException(
          ERROR_CODES.SUGGEST_NOT_EXIST,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      const website = await this.websiteRepo.findById(suggest?.websiteId);
      const sinbyte = await this.sinbyteRepo.findOneByCondition({
        leaderId: website?.leaderId,
      });
      if (!sinbyte) {
        throw new HttpException(
          ERROR_CODES.PLEASE_CONFIG_SINBYTE,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      const payload = {
        userId: req.user.sub,
        suggestId: createConfigDto.suggestId,
        type: TYPE_CONFIG.INDEX_LINK,
      };
      const config = await this.configRepo.create(payload);
      if (config.type == TYPE_CONFIG.INDEX_LINK) {
        const findAllLinkInJobs = await this.jobService.findAll({
          type: TYPE_CONFIG.INDEX_LINK,
        });

        const linkIsStarted = findAllLinkInJobs.map((link) => {
          return link.linkId;
        });

        const linkByConfigs = await this.linkRepo.findBySuggestIds({
          indexed: { $ne: INDEX_LINK.INDEX },
          suggestId: config.suggestId,
          _id: { $nin: linkIsStarted },
        });

        if (!linkByConfigs.length) {
          await this.configRepo.deleteManyByCondition({
            _id: config._id,
          });
          throw new HttpException(
            ERROR_CODES.NO_DATA_INDEXED,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }

        const links = linkByConfigs.map((link) => {
          return {
            linkId: link._id,
            linkUrl: link.linkUrl,
            suggestId: config.suggestId,
            configId: config._id,
            type: TYPE_CONFIG.INDEX_LINK,
            status: JOB_STATUS.WAITING,
          };
        });

        const maxChunkSize = Math.ceil(
          links.length / MAX_NUMBER_OF_CHUNK_DEFAULT_INDEX_LINK,
        );

        const chunkLinks = splitArrayIntoChunks(links, 0, maxChunkSize);

        for (const key in chunkLinks) {
          await this.jobService.createJobMany(chunkLinks[key]);
        }
      }
      return config;
    } catch (e) {
      throw e;
    }
  }

  async update(id, updateConfig): Promise<Config> {
    try {
      const currentTime = new Date();
      const startDate = new Date(
        currentTime.setSeconds(currentTime.getSeconds() + 10),
      );
      const endDate = new Date(
        currentTime.setDate(
          currentTime.getDate() + toNumber(updateConfig.date),
        ),
      );
      const payload = {
        ...updateConfig,
        startDate,
        endDate,
      };
      return await this.configRepo.update(id, payload);
    } catch (e) {
      throw e;
    }
  }

  async findById(id): Promise<Config | null> {
    try {
      const populateConfig = [
        { path: 'userId', select: 'name email' },
        { path: 'suggestId', select: 'name' },
      ];
      const config = await this.configRepo.findByIdWithSubFields(id, {
        populate: populateConfig,
      });
      if (config === null) {
        throw new HttpException(
          ERROR_CODES.SUGGEST_NOT_EXIST,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      return config;
    } catch (e) {
      throw e;
    }
  }

  async delete(id): Promise<boolean> {
    try {
      return await this.configRepo.softDelete(id);
    } catch (e) {
      throw e;
    }
  }

  async calculatePercentLinkIndex(configId): Promise<number> {
    try {
      let result = 0;
      const config = await this.configRepo.findOneById(configId);
      if (config) {
        const links = await this.linkModel
          .find({
            deleted_at: null,
            suggestId: config.suggestId,
          })
          .lean()
          .exec();
        if (links.length) {
          const linksIndexSuccess = await this.linkModel
            .find({
              deleted_at: null,
              suggestId: config.suggestId,
              status: STATUS_LINK.SUCCESS,
            })
            .lean()
            .exec();
          result = (linksIndexSuccess.length / links.length) * 100;
        }
        return Number(result.toFixed(2));
      }
    } catch (e) {
      throw e;
    }
  }

  async findBySuggestId(suggestId: string): Promise<Config | any> {
    try {
      return await this.configModel.findOne({ suggestId: suggestId }).exec();
    } catch (e) {
      throw e;
    }
  }
}
