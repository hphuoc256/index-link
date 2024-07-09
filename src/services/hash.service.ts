import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class HashService {
  async checkPassword(
    plainPassword: string,
    password: string,
  ): Promise<boolean> {
    return await bcrypt.compare(plainPassword, password);
  }

  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt();
    return await bcrypt.hash(password, salt);
  }
}
