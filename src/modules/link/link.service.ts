import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { LinkRepositoryInterface } from 'src/repositories/link.interface.repository';
import { Link } from 'src/entities/link.entity';
import { paginationQuery } from '../../utils';
import { Types } from 'mongoose';
import { SuggestRepositoryInterface } from '../../repositories/suggest.interface.repository';
import { ERROR_CODES } from '../../common/error-code';
import { STATUS_LINK } from '../../common/enum';
import { SheetUpload, UpdateManyDto } from '../../types/link';
import { read, utils } from 'xlsx';
import { CreateLinkDto } from './dto/create-link.dto';
import { forEach } from 'lodash';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const validUrl = require('valid-url');

const validUrlRegex =
  /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,})(\/[^\s]*)?$/u;

@Injectable()
export class LinkService {
  constructor(
    @Inject('LinkRepositoryInterface')
    private readonly linkRepo: LinkRepositoryInterface,
    @Inject('SuggestRepositoryInterface')
    private readonly suggestRepo: SuggestRepositoryInterface,
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
          linkUrl: new RegExp(req.query.search.toString(), 'i'),
        });
      }
      if (req.query.suggestId) {
        const suggest = await this.suggestRepo.findById(req.query.suggestId);
        if (suggest) {
          filter['suggestId'] = new Types.ObjectId(suggest._id);
        } else {
          filter['suggestId'] = [];
        }
      }
      if (req.query.status) {
        filter['status'] = req.query.status?.trim();
      }
      if (req.query.isFollow) {
        filter['isFollow'] = req.query.isFollow?.trim();
      }
      if (req.query.isIndex) {
        filter['isIndex'] = req.query.isIndex?.trim();
      }
      if (req.query.indexed) {
        filter['indexed'] = req.query.indexed?.trim();
      }

      const populateConfig = [
        { path: 'suggestId', select: 'name' },
        { path: 'userId', select: 'name email' },
      ];

      return await this.linkRepo.findAll(filter, {
        limit,
        skip,
        sort,
        populate: populateConfig,
      });
    } catch (e) {
      throw e;
    }
  }

  async create(createLinkDto, req) {
    try {
      const suggest = await this.suggestRepo.findById(createLinkDto?.suggestId);
      if (!suggest) {
        throw new HttpException(
          ERROR_CODES.SUGGEST_NOT_EXIST,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const { linkUrl, suggestId, keywords } = createLinkDto;

      const duplicateLinks = [];
      const invalidUrls = [];
      const validLinks = [];
      const exitLinks = [];
      const dataInserts = [];

      for (const link of linkUrl) {
        const trimLink = link.trim();
        if (!validUrl.isWebUri(trimLink) || !validUrlRegex.test(trimLink)) {
          invalidUrls.push(trimLink);
        } else if (validLinks.some((item) => item.linkUrl === trimLink)) {
          duplicateLinks.push(trimLink);
        } else {
          validLinks.push({
            linkUrl: trimLink,
            suggestId: suggestId,
            userId: req.user.sub,
            status: STATUS_LINK.WAITING,
            keywords: keywords,
          });
        }
      }

      if (validLinks?.length) {
        const links = await this.linkRepo.findBySuggestIds({
          suggestId: suggestId,
        });

        const urlValidLinks = links.map((url) => url.linkUrl);

        validLinks.forEach((link) => {
          if (urlValidLinks.includes(link.linkUrl)) {
            exitLinks.push(link);
          } else {
            dataInserts.push(link);
          }
        });
      }

      const links = await this.linkRepo.createMany(dataInserts);

      return {
        duplicateLinks: duplicateLinks,
        exitLinks: exitLinks,
        invalidUrls: invalidUrls,
        validLinks: links,
      };
    } catch (e) {
      throw e;
    }
  }

  async update(id, updateLinkDto): Promise<Link> {
    try {
      const link = await this.linkRepo.findById(id);

      if (!link) {
        throw new HttpException(
          ERROR_CODES.LINK_NOT_EXIST,
          HttpStatus.NOT_FOUND,
        );
      }

      return await this.linkRepo.update(id, updateLinkDto);
    } catch (e) {
      throw e;
    }
  }

  async findIdWithSubFields(id): Promise<Link | null> {
    try {
      const populateConfig = [
        { path: 'suggestId', select: 'name' },
        { path: 'userId', select: 'name email' },
      ];
      const link = await this.linkRepo.findByIdWithSubFields(id, {
        populate: populateConfig,
      });
      if (link === null) {
        throw new HttpException(
          ERROR_CODES.SUGGEST_NOT_EXIST,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      return link;
    } catch (e) {
      throw e;
    }
  }

  async delete(id): Promise<boolean> {
    try {
      return await this.linkRepo.permanentlyDelete(id);
    } catch (e) {
      throw e;
    }
  }

  async deleteMany(ids): Promise<boolean> {
    try {
      let isDelete = true;
      const deleteItem = [];
      for (const id of ids) {
        const link = await this.linkRepo.findById(id);
        if (!link) {
          deleteItem.push(id);
          isDelete = false;
        }
      }
      if (isDelete)
        return await this.linkRepo.deleteManyByCondition({ _id: ids });
      throw new HttpException(
        `${ERROR_CODES.LINK_NOT_EXIST} id ${deleteItem}`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    } catch (e) {
      throw e;
    }
  }

  async updateLinkIsChecked() {
    try {
      return await this.linkRepo.findAndUpdateByCondition(
        {
          isChecked: true,
        },
        {
          isChecked: false,
        } as UpdateManyDto,
      );
    } catch (e) {
      throw e;
    }
  }

  async upload(file, req) {
    try {
      console.log(file);

      const suggestId = req.params.suggestId;

      const suggest = await this.suggestRepo.findById(suggestId);

      if (!suggest) {
        throw new HttpException(
          ERROR_CODES.SUGGEST_NOT_EXIST,
          HttpStatus.NOT_FOUND,
        );
      }

      const workbook = read(file.buffer);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = utils.sheet_to_json(sheet) as SheetUpload[];

      const duplicateLinks = [];
      const invalidUrls = [];
      const validLinks = [];
      const exitLinks = [];
      const dataInserts = [];

      for (const item of data) {
        const trimLink = item?.URL || item?.Url || item?.url;
        const keywordString = item?.KEYWORD || item?.Keyword || item?.keyword;
        const keywords = keywordString
          ? keywordString.split(',').map((keyword) => keyword.trim())
          : [];

        if (!validUrl.isWebUri(trimLink) || !validUrlRegex.test(trimLink)) {
          invalidUrls.push(trimLink);
        } else if (validLinks.some((item) => item.linkUrl === trimLink)) {
          duplicateLinks.push(trimLink);
        } else {
          validLinks.push({
            linkUrl: trimLink,
            suggestId: suggestId,
            userId: req.user.sub,
            status: STATUS_LINK.WAITING,
            keywords: keywords,
          });
        }
      }

      if (validLinks?.length) {
        const links = await this.linkRepo.findBySuggestIds({
          suggestId: suggestId,
        });

        const urlValidLinks = links.map((url) => url.linkUrl);

        validLinks.forEach((link) => {
          if (urlValidLinks.includes(link.linkUrl)) {
            exitLinks.push(link);
          } else {
            dataInserts.push(link);
          }
        });
      }

      const links = await this.linkRepo.createMany(dataInserts);

      return {
        duplicateLinks: duplicateLinks,
        exitLinks: exitLinks,
        invalidUrls: invalidUrls,
        validLinks: links,
      };
    } catch (e) {
      throw e;
    }
  }
}
