import {
  ArgumentMetadata,
  HttpException,
  HttpStatus,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ERROR_CODES } from '../common/error-code';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mimeTypes = require('mime-types');

@Injectable()
export class FileSizeValidationPipe implements PipeTransform {
  async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
    const file = value;
    if (!file) {
      throw new HttpException(
        ERROR_CODES.FILE_IS_REQUIRED,
        HttpStatus.BAD_REQUEST,
      );
    }

    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheet.sheet',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    const mimeType = mimeTypes.lookup(file.originalname);

    if (!allowedMimeTypes.includes(mimeType)) {
      throw new HttpException(
        {
          message: ERROR_CODES.ONLY_EXCEL_FILE_ALLOWED,
          statusCode: HttpStatus.BAD_REQUEST,
          status: false,
          error: {},
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    return value;
  }
}
