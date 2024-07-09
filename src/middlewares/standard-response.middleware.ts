// standard-response.middleware.ts
import { HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ERROR_CODES } from '../common/error-code';

@Injectable()
export class StandardResponseMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    res.locals.standardResponse = (data: any = null, error: any = null) => {
      const responseBody = {
        message: data
          ? ERROR_CODES.OK
          : error.status
            ? error.message
            : ERROR_CODES.FAILED || ERROR_CODES.ERROR_SYSTEM,
        statusCode: data
          ? HttpStatus.OK
          : error.status ??
            (HttpStatus.UNPROCESSABLE_ENTITY ||
              HttpStatus.INTERNAL_SERVER_ERROR),
        status: !!data,
      };
      if (data) {
        responseBody['data'] = data;
      } else {
        responseBody['error'] = error
          ? {
              code:
                error.status ??
                (HttpStatus.UNPROCESSABLE_ENTITY ||
                  HttpStatus.INTERNAL_SERVER_ERROR),
              errors: error.status
                ? [error.message]
                : ERROR_CODES.FAILED || ERROR_CODES.ERROR_SYSTEM,
            }
          : null;
      }
      res.json(responseBody);
    };
    next();
  }
}
