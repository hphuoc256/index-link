import { SORT_TYPE } from '../common/enum';

interface ResponsePaginate {
  page: number;
  limit: number;
  total: number;
}

export type ResponseAllWithPaginate = {
  pagination: ResponsePaginate;
  items: any;
};

export type FindAllResponse<T> = { pagination: ResponsePaginate; items: T[] };

export type SortParams = { sort_by: string; sort_type: SORT_TYPE };

export type SearchParams = { keyword: string; field: string };

export type PaginateParams = { offset: number; limit: number };

export type SignPayload = {
  type: string;
  accessToken: string;
  refreshToken: string;
  expiresIn?: string;
};

export type JwtPayload = {
  email: string;
  sub: string;
};

export type AuthJwtWithUser = {
  token: SignPayload;
};

export type Pagination = { page: number; limit: number; skip?: number };

export type ToNumberOptions = {
  default?: number;
  min?: number;
  max?: number;
};
