import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { LinkService } from './link.service';
import { MyLoggerService } from '../logger/logger.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiConsumes,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/middlewares/authguard.middleware';
import { PermissionGuard } from 'src/middlewares/permission.guard.middleware';
import { Roles } from 'src/decorators/role.decorator';
import { CreateLinkDto } from './dto/create-link.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadDto } from './dto/upload.dto';
import { FileSizeValidationPipe } from '../../pipes/file-size-validation.pipe';
import { fullPath } from '../../utils/route';
import { UpdateLinkDto } from './dto/update-link.dto';

@ApiBearerAuth()
@Controller('link')
@ApiTags('Link')
export class LinkController {
  constructor(
    private readonly linkService: LinkService,
    private logger: MyLoggerService,
  ) {
    this.logger.setContext('LinkController');
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('user', 'leader', 'admin')
  @ApiOperation({
    summary: 'admin | leader | user',
    description: 'Endpoint all link',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'linkUrl',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description: 'ASC | DESC',
  })
  @ApiQuery({
    name: 'suggestId',
    required: false,
    type: String,
    description: '',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'success | waiting | cancel',
  })
  @ApiQuery({
    name: 'isFollow',
    required: false,
    type: String,
    description: 'follow | waiting | nofollow',
  })
  @ApiQuery({
    name: 'isIndex',
    required: false,
    type: String,
    description: 'index | waiting | noindex | fail',
  })
  @ApiQuery({
    name: 'indexed',
    required: false,
    type: String,
    description: 'index | waiting | noindex | fail',
  })
  @Get()
  async findAll(@Req() req, @Res() res) {
    try {
      const data = await this.linkService.findAll(req);
      this.logger.log(JSON.stringify(data), fullPath(req));
      return res.locals.standardResponse(data);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }

  /*@UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('user')
  @Post()
  async create(@Res() res, @Body() linkCreate: CreateLinkDto) {
    try {
      const link = await this.linkService.create(linkCreate);
      this.logger.log(JSON.stringify(link), 'LinkController/CreateSuccess');
      return res.locals.standardResponse(link);
    } catch (e) {
      this.logger.error('LinkController/CreateFail', e);
      return res.locals.standardResponse(null, e);
    }
  }*/

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('user', 'leader', 'admin')
  @ApiOperation({
    summary: 'admin | leader | user',
    description: 'Endpoint create many link',
  })
  @Post()
  async createMany(@Res() res, @Req() req, @Body() linksCreate: CreateLinkDto) {
    try {
      const link = await this.linkService.create(linksCreate, req);
      this.logger.log(JSON.stringify(link), fullPath(req));
      return res.locals.standardResponse(link);
    } catch (e) {
      this.logger.error('LinkController/CreateFail', e);
      return res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('user', 'leader', 'admin')
  @ApiOperation({
    summary: 'admin | leader | user',
    description: 'Get link detail',
  })
  @Get(':id')
  async findById(@Param('id') id: string, @Res() res, @Req() req) {
    try {
      const user = await this.linkService.findIdWithSubFields(id);
      this.logger.log(JSON.stringify(user), fullPath(req));
      res.locals.standardResponse(user);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('user', 'leader', 'admin')
  @ApiOperation({
    summary: 'admin | leader | user',
    description: 'Update link',
  })
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateLinkDto: UpdateLinkDto,
    @Res() res,
  ) {
    try {
      const result = await this.linkService.update(id, updateLinkDto);
      this.logger.log(JSON.stringify(result), 'LinkController/UpdateSuccess');
      res.locals.standardResponse(result);
    } catch (e) {
      this.logger.error('LinkController/UpdateFail', e);
      res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('user', 'leader', 'admin')
  @ApiOperation({
    summary: 'admin | leader | user',
    description: 'Endpoint delete link',
  })
  @Delete(':id')
  async delete(@Param('id') id: string, @Res() res) {
    try {
      const result = await this.linkService.delete(id);
      this.logger.log(JSON.stringify(result), 'LinkController/DeleteSuccess');
      res.locals.standardResponse(result);
    } catch (e) {
      this.logger.error('LinkController/DeleteFail', e);
      res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('leader', 'user', 'admin')
  @ApiOperation({
    summary: 'admin | leader | user',
    description: 'Endpoint delete many link',
  })
  @Delete()
  async deleteMany(@Body() ids: string[], @Res() res, @Req() req) {
    try {
      const result = await this.linkService.deleteMany(ids);
      this.logger.log(JSON.stringify(result), fullPath(req));
      res.locals.standardResponse(result);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('user', 'leader', 'admin')
  @ApiOperation({
    summary: 'admin | leader | user',
    description: 'Upload excel file to create many link',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @Post('upload/:suggestId')
  async upload(
    @Res() res,
    @Req() req,
    @Param('suggestId') suggestId: string,
    @Body() uploadDto: UploadDto,
    @UploadedFile(new FileSizeValidationPipe())
    file: Express.Multer.File,
  ) {
    try {
      const link = await this.linkService.upload(file, req);
      this.logger.log(JSON.stringify(link), fullPath(req));
      return res.locals.standardResponse(link);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      return res.locals.standardResponse(null, e);
    }
  }
}
