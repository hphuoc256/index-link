import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { APP_PIPE } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './entities/user.entity';
import { Role, RoleSchema } from './entities/role.entity';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { RoleModule } from './modules/role/role.module';
import { UserModule } from './modules/user/user.module';
import { LoggerModule } from './modules/logger/logger.module';
import { PermissionGuard } from './middlewares/permission.guard.middleware';
import { TelegramModule } from './modules/telegram/telegram.module';
import { UserRepository } from './repositories/user.repository';
import { RoleRepository } from './repositories/role.repository';
import { ValidationPipe } from './pipes/custom-validate.pipe';
import { UserService } from './modules/user/user.service';
import { JwtService } from '@nestjs/jwt';
import { HashService } from './services/hash.service';
import { StandardResponseMiddleware } from './middlewares/standard-response.middleware';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { WebsiteModule } from './modules/website/website.module';
import { UserWebsiteModule } from './modules/userwebsite/userwebsite.module';
import { SuggestModule } from './modules/suggest/suggest.module';
import { LinkModule } from './modules/link/link.module';
import { ConfigModule } from './modules/config/config.module';
import { HistoryModule } from './modules/history/history.module';
import { NotifyModule } from './modules/notify/notify.module';
import { config } from 'dotenv';
import { Website, WebsiteSchema } from './entities/website.entity';
import { WebsiteRepository } from './repositories/website.repository';
import { UserWebsiteRepository } from './repositories/userwebsite.repository';
import { UserWebsite, UserWebsiteSchema } from './entities/userwebsite.entity';
import { Telegram, TelegramSchema } from './entities/telegram.entity';
import { TelegramRepository } from './repositories/telegram.repository';
import { EventModule } from './modules/event/event.module';
import { SinbyteModule } from './modules/sinbyte/sinbyte.module';
config();

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api/(.*)'],
    }),
    MongooseModule.forRoot(
      process.env.DATABASE_URI || 'mongodb://localhost:27017/ServiceCheckLink',
    ),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Website.name, schema: WebsiteSchema },
      { name: UserWebsite.name, schema: UserWebsiteSchema },
      { name: Telegram.name, schema: TelegramSchema },
    ]),
    ScheduleModule.forRoot(),
    AuthModule,
    RoleModule,
    UserModule,
    LoggerModule,
    WebsiteModule,
    UserWebsiteModule,
    SuggestModule,
    LinkModule,
    ConfigModule,
    HistoryModule,
    NotifyModule,
    TelegramModule,
    EventModule,
    SinbyteModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PermissionGuard,
    { provide: 'UserRepositoryInterface', useClass: UserRepository },
    { provide: 'RoleRepositoryInterface', useClass: RoleRepository },
    {
      provide: 'WebsiteRepositoryInterface',
      useClass: WebsiteRepository,
    },
    {
      provide: 'UserWebsiteRepositoryInterface',
      useClass: UserWebsiteRepository,
    },
    {
      provide: 'TelegramRepositoryInterface',
      useClass: TelegramRepository,
    },
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
    UserService,
    JwtService,
    HashService,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(StandardResponseMiddleware).forRoutes('*');
    // consumer.apply(FingerPrintMiddleware).forRoutes('*');
  }
}
