import { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerDocumentOptions,
  SwaggerModule,
} from '@nestjs/swagger';
import { config } from 'dotenv';
import { mapErrorCodesToSwaggerSchema } from '../utils';
config();
const { SWAGGER_ENABLE, SWAGGER_PREFIX, SWAGGER_VERSION, APP_NAME } =
  process.env;

export const setupSwagger = (app: INestApplication): void => {
  if (!SWAGGER_ENABLE || SWAGGER_ENABLE === 'false') {
    return;
  }
  const config = new DocumentBuilder()
    .setTitle(`${APP_NAME}`)
    .setDescription('The API Service Check Link')
    .setVersion(SWAGGER_VERSION)
    .addBearerAuth()
    .build();
  const options: SwaggerDocumentOptions = {
    deepScanRoutes: true,
  };
  const document = SwaggerModule.createDocument(app, config, options);
  document.components.schemas = {
    ...document.components.schemas,
    ErrorCodes: mapErrorCodesToSwaggerSchema(),
  };
  SwaggerModule.setup(SWAGGER_PREFIX, app, document);
};
