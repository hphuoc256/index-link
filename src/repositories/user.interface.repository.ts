import { BaseRepositoryInterface } from './base/base.interface.repository';
import { User } from '../entities/user.entity';

export interface UserRepositoryInterface extends BaseRepositoryInterface<User> {
  findByEmail(email: string, isPassword?: boolean): Promise<User | any>;

  updateRefreshToken({
    id,
    refreshToken,
  }: {
    id: string;
    refreshToken: string;
  }): Promise<User>;

  findWithPasswordById({ id }: { id: string }): Promise<User | undefined | any>;

  findByIdWithSubFields(
    id: string,
    options: {
      populate?: string[] | any;
    },
  ): Promise<User>;

  findOneWithRefreshToken(id): Promise<User>;

  find(query: any): Promise<User[]>;
}
