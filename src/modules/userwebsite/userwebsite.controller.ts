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
import { UserWebsiteService } from './userwebsite.service';
import { MyLoggerService } from '../logger/logger.service';
import { PermissionGuard } from 'src/middlewares/permission.guard.middleware';
import { AuthGuard } from 'src/middlewares/authguard.middleware';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/decorators/role.decorator';
import { CreateUserWebsiteDto } from './dto/create-userwebsite.dto';
import { UpdateUserWebsiteDto } from './dto/update-userwebsite.dto';

@ApiBearerAuth()
@Controller('userwebsite')
@ApiTags('UserWebsite')
export class UserwebsiteController {
  constructor(
    private readonly userWebsiteService: UserWebsiteService,
    private logger: MyLoggerService,
  ) {
    this.logger.setContext('UserWebsiteController');
  }

  // @UseGuards(PermissionGuard)
  // @UseGuards(AuthGuard)
  // @Roles('leader')
  // @ApiQuery({ name: 'limit', required: false, type: Number })
  // @ApiQuery({ name: 'page', required: false, type: Number })
  // @ApiQuery({
  //   name: 'search',
  //   required: false,
  //   type: String,
  //   description: 'name',
  // })
  // @ApiQuery({
  //   name: 'sort',
  //   required: false,
  //   type: String,
  //   description: 'ASC | DESC',
  // })
  // @Get()
  // async findAll(@Req() req, @Res() res) {
  //   try {
  //     const userWebsites = await this.userWebsiteService.findAll(req);
  //     this.logger.log(
  //       JSON.stringify(userWebsites),
  //       'UserWebsiteController/GetSuccess',
  //     );
  //     return res.locals.standardResponse(userWebsites);
  //   } catch (e) {
  //     this.logger.error('UserWebsiteController/GetFail', e);
  //     res.locals.standardResponse(null, e);
  //   }
  // }

  // @UseGuards(PermissionGuard)
  // @UseGuards(AuthGuard)
  // @Roles('leader')
  // @Post()
  // async create(
  //   @Res() res,
  //   @Req() req,
  //   @Body() userWebsiteCreate: CreateUserWebsiteDto,
  // ) {
  //   try {
  //     const userWebsite = await this.userWebsiteService.create(
  //       userWebsiteCreate,
  //       req,
  //     );
  //     this.logger.log(
  //       JSON.stringify(userWebsite),
  //       'UserWebsiteController/CreateSuccess',
  //     );
  //     return res.locals.standardResponse(userWebsite);
  //   } catch (e) {
  //     this.logger.error('UserWebsiteController/CreateFail', e);
  //     return res.locals.standardResponse(null, e);
  //   }
  // }

  // @UseGuards(PermissionGuard)
  // @UseGuards(AuthGuard)
  // @Roles('leader')
  // @Get(':id')
  // async findById(@Param('id') id: string, @Res() res) {
  //   try {
  //     const userWebsite = await this.userWebsiteService.findById(id);
  //     this.logger.log(
  //       JSON.stringify(userWebsite),
  //       'UserWebsiteController/GetDetailSuccess',
  //     );
  //     res.locals.standardResponse(userWebsite);
  //   } catch (e) {
  //     this.logger.error('UserWebsiteController/GetDetailFail', e);
  //     res.locals.standardResponse(null, e);
  //   }
  // }

  // @UseGuards(PermissionGuard)
  // @UseGuards(AuthGuard)
  // @Roles('leader')
  // @Put(':id')
  // async update(
  //   @Param('id') id: string,
  //   @Body() updateUserWebsiteDto: UpdateUserWebsiteDto,
  //   @Res() res,
  // ) {
  //   try {
  //     const result = await this.userWebsiteService.update(
  //       id,
  //       updateUserWebsiteDto,
  //     );
  //     this.logger.log(
  //       JSON.stringify(result),
  //       'UserWebsiteController/UpdateSuccess',
  //     );
  //     res.locals.standardResponse(result);
  //   } catch (e) {
  //     this.logger.error('UserWebsiteController/UpdateFail', e);
  //     res.locals.standardResponse(null, e);
  //   }
  // }

  // @UseGuards(PermissionGuard)
  // @UseGuards(AuthGuard)
  // @Roles('user')
  // @Delete(':id')
  // async delete(@Param('id') id: string, @Res() res) {
  //   try {
  //     const result = await this.userWebsiteService.delete(id);
  //     this.logger.log(
  //       JSON.stringify(result),
  //       'UserWebsiteController/DeleteSuccess',
  //     );
  //     res.locals.standardResponse(result);
  //   } catch (e) {
  //     this.logger.error('UserWebsiteController/DeleteFail', e);
  //     res.locals.standardResponse(null, e);
  //   }
  // }
}
