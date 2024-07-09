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
  UseGuards,
} from '@nestjs/common';
import { WebsiteService } from './website.service';
import { MyLoggerService } from '../logger/logger.service';
import { PermissionGuard } from 'src/middlewares/permission.guard.middleware';
import { AuthGuard } from 'src/middlewares/authguard.middleware';
import { Roles } from 'src/decorators/role.decorator';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CreateWebsiteDto } from './dto/create-website.dto';
import { UpdateWebsiteDto } from './dto/update-website.dto';
import { fullPath } from '../../utils/route';

@ApiBearerAuth()
@Controller('website')
@ApiTags('Website')
export class WebsiteController {
  constructor(
    private readonly websiteService: WebsiteService,
    private logger: MyLoggerService,
  ) {
    this.logger.setContext('WebsiteController');
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('leader', 'admin', 'user')
  @ApiOperation({
    summary: 'admin | leader | user',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'domain',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description: 'ASC | DESC',
  })
  @Get()
  async findAll(@Req() req, @Res() res) {
    try {
      const websites = await this.websiteService.findAll(req);
      this.logger.log(JSON.stringify(websites), fullPath(req));
      return res.locals.standardResponse(websites);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('leader', 'admin', 'user')
  @ApiOperation({
    summary: 'admin | leader | user',
  })
  @Post()
  async create(
    @Res() res,
    @Req() req,
    @Body() websiteCreate: CreateWebsiteDto,
  ) {
    try {
      const website = await this.websiteService.create(websiteCreate, req);
      this.logger.log(JSON.stringify(website), fullPath(req));
      return res.locals.standardResponse(website);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      return res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('leader', 'admin', 'user')
  @ApiOperation({
    summary: 'admin | leader | user',
  })
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateWebsiteDto: UpdateWebsiteDto,
    @Res() res,
    @Req() req,
  ) {
    try {
      const result = await this.websiteService.update(
        id,
        updateWebsiteDto,
        req,
      );
      this.logger.log(JSON.stringify(result), fullPath(req));
      res.locals.standardResponse(result);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('leader', 'admin', 'user')
  @ApiOperation({
    summary: 'admin | leader | user',
  })
  @Get(':id')
  async findById(@Param('id') id: string, @Res() res, @Req() req) {
    try {
      const website = await this.websiteService.findById(id, req);
      this.logger.log(JSON.stringify(website), fullPath(req));
      res.locals.standardResponse(website);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('leader', 'admin')
  @ApiOperation({
    summary: 'admin | leader',
  })
  @Delete(':id')
  async delete(@Param('id') id: string, @Res() res, @Req() req) {
    try {
      const result = await this.websiteService.delete(id);
      this.logger.log(JSON.stringify(result), fullPath(req));
      res.locals.standardResponse(result);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('leader', 'admin')
  @ApiOperation({
    summary: 'admin | leader',
  })
  @Delete()
  async deleteMany(@Body() ids: string[], @Res() res, @Req() req) {
    try {
      const result = await this.websiteService.deleteMany(ids);
      this.logger.log(JSON.stringify(result), fullPath(req));
      res.locals.standardResponse(result);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }
}
