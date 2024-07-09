import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../common/error-code';

export class CustomGuardException extends HttpException {
  constructor() {
    super(
      {
        message: ERROR_CODES.UNAUTHORIZED,
        statusCode: HttpStatus.UNAUTHORIZED,
        status: false,
        error: {
          code: HttpStatus.UNAUTHORIZED,
          errors: [ERROR_CODES.UNAUTHORIZED],
        },
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
