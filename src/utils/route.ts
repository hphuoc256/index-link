import { Request } from 'express';

export const fullPath = (req: Request): string => {
  const user =
    req['user'] && req['user']['email'] ? req['user']['email'] : 'anonymous';

  if (user === 'anonymous') {
    return req.originalUrl;
  }
  return `${user} - ${req.originalUrl}`;
};
