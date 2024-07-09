import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { config } from 'dotenv';
import { join } from 'path';
import { setupSwagger } from './configurations/swagger.configuration';
config();

async function bootstrap() {
  const { APP_PORT, SWAGGER_PREFIX, APP_URL, APP_PREFIX } = process.env;

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const publicPath = join(__dirname, '../../public/');
  app.useStaticAssets(publicPath, {
    prefix: '/public/',
  });

  app.enableCors();
  app.setGlobalPrefix(APP_PREFIX);

  // validate
  app.useGlobalPipes(new ValidationPipe());

  // swagger
  setupSwagger(app);

  await app.listen(APP_PORT, async () => {
    const serverUrl = await app.getUrl();
    Logger.log(`API Swagger: ${serverUrl}/${SWAGGER_PREFIX}/`);
    console.log(`Server running at: ${APP_URL}:${APP_PORT}/${APP_PREFIX}`);
  });
}
bootstrap().catch();
