export enum USER_STATUS {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum ROLE {
  ADMIN = 'admin',
  LEADER = 'leader',
  USER = 'user',
}

export enum SORT_TYPE {
  'DESC' = 'desc',
  'ASC' = 'asc',
}

export enum STATUS_LINK {
  SUCCESS = 'success',
  WAITING = 'waiting',
  CANCEL = 'cancel',
}

export enum FOLLOW_LINK {
  FOLLOW = 'follow',
  WAITING = 'waiting',
  NOFOLLOW = 'nofollow',
}

export enum INDEX_LINK {
  INDEX = 'index',
  WAITING = 'waiting',
  NOINDEX = 'noindex',
  FAIL = 'fail',
}

export enum STATUS_CONFIG {
  SUCCESS = 'success',
  WAITING = 'waiting',
  CANCEL = 'cancel',
}

export enum TYPE_CONFIG {
  NORMAL = 'normal',
  AUTO = 'auto',
  CHECK_LINK_INDEX = 'checklinkindex',
  CHECK_LINK = 'checklink',
  INDEX_LINK = 'indexlink',
}

export enum STATUS_CRON {
  SUCCESS = 'success',
  FAIL = 'fail',
  PENDING = 'pending',
}

export enum WEBSITE_STATUS {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum JOB_TYPE {
  DAILY = 'daily',
  NORMAL = 'normal',
  CHECK_LINK_INDEX = 'checklinkindex',
  CHECK_LINK = 'checklink',
  INDEX_LINK = 'indexlink',
}

export enum JOB_STATUS {
  WAITING = 'waiting',
  PROCESSING = 'processing',
}
