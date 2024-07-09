import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../common/error-code';

export class CustomPermissionException extends HttpException {
  constructor() {
    super(
      {
        message: ERROR_CODES.FORBIDDEN,
        statusCode: HttpStatus.FORBIDDEN,
        status: false,
        error: {
          code: HttpStatus.FORBIDDEN,
          errors: [ERROR_CODES.FORBIDDEN],
        },
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
