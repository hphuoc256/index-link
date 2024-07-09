export interface UserCreateOrUpdate {
  email: string;
  password?: string;
  name?: string;
  roleId?: string;
  leaderId?: string;
  verifiedImages?: string[];
  telegramId?: string;
}
