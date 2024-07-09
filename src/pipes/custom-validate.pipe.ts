import {
  ArgumentMetadata,
  Injectable,
  PipeTransform,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { ERROR_CODES } from '../common/error-code';

@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  async transform(value: any, metadata: ArgumentMetadata) {
    if (!value) {
      throw new HttpException(
        ERROR_CODES.NO_DATA_SUBMITTED,
        HttpStatus.BAD_REQUEST,
      );
    }

    const { metatype } = metadata;
    if (!metatype || !ValidationPipe.toValidate(metatype)) {
      return value;
    }

    const object = plainToClass(metatype, value);
    const errors = await validate(object);

    if (errors.length > 0) {
      throw new BadRequestException(
        ValidationPipe.buildValidationErrors(errors),
      );
    }
    return value;
  }

  private static buildValidationErrors(errors: ValidationError[]) {
    const messages = {};

    function extractChildrenMessages(error: ValidationError) {
      if (error.children && error.children.length > 0) {
        for (const childError of error.children) {
          extractChildrenMessages(childError);
        }
      }

      for (const key in error.constraints) {
        if (error.constraints.hasOwnProperty(key)) {
          if (!messages[error.property]) {
            messages[error.property] = [];
          }
          messages[error.property].push(error.constraints[key]);
        }
      }
    }

    for (const error of errors) {
      extractChildrenMessages(error);
    }

    return {
      message: ERROR_CODES.BAD_REQUEST,
      statusCode: HttpStatus.BAD_REQUEST,
      status: false,
      error: {
        code: HttpStatus.BAD_REQUEST,
        errors: messages,
      },
    };
  }

  private static toValidate(metatype: any): boolean {
    const types = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
