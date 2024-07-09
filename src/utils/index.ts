import { HttpException, HttpStatus } from '@nestjs/common';
import { Pagination, ToNumberOptions } from '../types/global';
import { ERROR_CODES } from '../common/error-code';
import { Types } from 'mongoose';

export const MAX_NUMBER_OF_CHUNK_DEFAULT = 300;
export const MAX_NUMBER_OF_CHUNK_DEFAULT_WEEK = 20;
export const MAX_NUMBER_OF_CHUNK_DEFAULT_CHECK_LINK_INDEX = 100;
export const MAX_NUMBER_OF_CHUNK_DEFAULT_INDEX_LINK = 100;

export const responseError = (message: string = 'FAILED') => {
  throw new HttpException(message, HttpStatus.UNPROCESSABLE_ENTITY);
};

export const paginationQuery = ({
  page = 1,
  limit = 10,
}: Pagination): Pagination => {
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const mapErrorCodesToSwaggerSchema = () => {
  const errorSchema = {
    type: 'object',
    properties: {},
  };

  for (const key in ERROR_CODES) {
    if (ERROR_CODES.hasOwnProperty(key)) {
      errorSchema.properties[key] = {
        type: ERROR_CODES[key],
      };
    }
  }
  return errorSchema;
};

export const toNumber = (value: string, opts: ToNumberOptions = {}): number => {
  let newValue: number = Number.parseInt(value || String(opts.default), 10);

  if (Number.isNaN(newValue)) {
    newValue = opts.default;
  }

  if (opts.min) {
    if (newValue < opts.min) {
      newValue = opts.min;
    }

    if (newValue > opts.max) {
      newValue = opts.max;
    }
  }

  return newValue;
};

export const toNonSpecialChar = (str: string): string => {
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
  str = str.replace(/đ/g, 'd');
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, 'A');
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, 'E');
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, 'I');
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, 'O');
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, 'U');
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, 'Y');
  str = str.replace(/Đ/g, 'D');
  str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ''); // ̀ ́ ̃ ̉ ̣  huyền, sắc, ngã, hỏi, nặng
  str = str.replace(/\u02C6|\u0306|\u031B/g, ''); // ˆ ̆ ̛  Â, Ê, Ă, Ơ, Ư
  str = str.replace(/ + /g, ' ');
  str = str.trim();
  str = str.replace(
    /!|@|%|\^|\*|\(|\)|\+|\=|\<|\>|\?|\/|,|\.|\:|\;|\'|\"|\&|\#|\[|\]|~|\$|_|`|-|{|}|\||\\/g,
    ' ',
  );
  return str.toLowerCase();
};

export const toObjectId = (val: string) => {
  if (Types.ObjectId.isValid(val)) {
    return new Types.ObjectId(val);
  }

  return val;
};

export const splitArrayIntoChunks = (
  array: any[] = [],
  numberOfLoopStart: number = 0,
  maxChunkSize: number = 300,
  maxNumberChunks: number = MAX_NUMBER_OF_CHUNK_DEFAULT,
) => {
  const maxNumberOfChunks: number = maxNumberChunks;
  const result: any[] = [];
  const numberOfChunks: number = Math.min(
    Math.ceil(array.length / maxChunkSize),
    maxNumberOfChunks,
  );
  let remainingItems: number = array.length;
  let startIndex: number = 0;

  for (let i = numberOfLoopStart; i < numberOfChunks; i++) {
    const chunkSize: number =
      i === numberOfChunks - 1 ? remainingItems : maxChunkSize;
    result.push(array.slice(startIndex, startIndex + chunkSize));
    startIndex += chunkSize;
    remainingItems -= chunkSize;
  }
  return result.reduce((acc, curr, index: number) => {
    acc[index + 1] = curr.map((obj) => ({
      ...obj,
      numberOfLoop: index + 1,
    }));
    return acc;
  }, {});
};
