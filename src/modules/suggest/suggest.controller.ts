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
import { MyLoggerService } from '../logger/logger.service';
import { SuggestService } from './suggest.service';
import { PermissionGuard } from '../../middlewares/permission.guard.middleware';
import { AuthGuard } from '../../middlewares/authguard.middleware';
import { Roles } from '../../decorators/role.decorator';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CreateSuggestDto } from './dto/create-suggest.dto';
import { UpdateSuggestDto } from './dto/update-suggest.dto';
import { fullPath } from '../../utils/route';
import { DeleteManySuggestDto } from './dto/delete-many-suggest.dto';

@ApiBearerAuth()
@Controller('suggest')
@ApiTags('Suggest')
export class SuggestController {
  constructor(
    private readonly suggestService: SuggestService,
    private logger: MyLoggerService,
  ) {
    this.logger.setContext('SuggestController');
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('user', 'leader', 'admin')
  @ApiOperation({
    summary: 'admin | leader | user',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'name | telegram',
  })
  @ApiQuery({
    name: 'searchDomainOrUserName', // Added missing property
    required: false,
    type: String,
    description: 'domain | name',
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
      const suggests = await this.suggestService.findAll(req);
      this.logger.log(JSON.stringify(suggests), fullPath(req));
      return res.locals.standardResponse(suggests);
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
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'name | telegram',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description: 'ASC | DESC',
  })
  @Get(':websiteId')
  async findByWebsite(
    @Param('websiteId') websiteId: string,
    @Req() req,
    @Res() res,
  ) {
    try {
      const suggests = await this.suggestService.findByWebsite(req, websiteId);
      this.logger.log(JSON.stringify(suggests), fullPath(req));
      return res.locals.standardResponse(suggests);
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
  })
  @Post()
  async create(
    @Res() res,
    @Req() req,
    @Body() suggestCreate: CreateSuggestDto,
  ) {
    try {
      const user = await this.suggestService.create(suggestCreate, req);
      this.logger.log(JSON.stringify(user), fullPath(req));
      return res.locals.standardResponse(user);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      return res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('user', 'leader', 'admin')
  @ApiOperation({
    summary: 'admin | leader | user',
  })
  @Get('detail/:id')
  async findById(@Param('id') id: string, @Res() res, @Req() req) {
    try {
      const suggest = await this.suggestService.findById(id);
      this.logger.log(JSON.stringify(suggest), fullPath(req));
      res.locals.standardResponse(suggest);
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
  })
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateSuggestDto: UpdateSuggestDto,
    @Res() res,
    @Req() req,
  ) {
    try {
      const result = await this.suggestService.update(id, updateSuggestDto);
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
  })
  @Delete('delete-many')
  async deleteMany(
    @Body() deleteManySuggestDto: DeleteManySuggestDto,
    @Res() res,
    @Req() req,
  ) {
    try {
      const result = await this.suggestService.deleteMany(
        deleteManySuggestDto,
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
  @Roles('user', 'leader', 'admin')
  @ApiOperation({
    summary: 'admin | leader | user',
  })
  @Delete(':id')
  async delete(@Param('id') id: string, @Res() res, @Req() req) {
    try {
      const result = await this.suggestService.delete(id);
      this.logger.log(JSON.stringify(result), fullPath(req));
      res.locals.standardResponse(result);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }
}
