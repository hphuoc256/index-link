export const ERROR_CODES = {
  OK: 'Ok',
  FAILED: 'Failed, try again',
  ERROR_SYSTEM: 'Error system',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  BAD_REQUEST: 'Bad Request',
  NOT_FOUND: 'Not found',
  ACCESS_DENIED: 'Access Denied',
  NO_DATA_SUBMITTED: 'No data submitted',
  NO_DATA_INDEXED:
    'No links found with not yet waiting ,noindex ,fail status indexed',
  USER_NOT_FOUND: 'User not found',
  PASSWORD_INCORRECT: 'Password incorrect',
  OLD_PASSWORD_INCORRECT: 'Old password is incorrect',
  EMAIL_EXIST: 'Email already existed',
  CREATE_FAILED: 'Create failed',
  USER_ARE_NOT_LEADER: 'User are not leader',
  LEADER_REQUIRED: 'Leader is required',
  LEADER_ID_REQUIRED: 'Leader Id is required',
  LEADER_NOT_FOUND: 'Leader not exist',
  UPDATE_FAILED: 'Update failed',
  DELETE_FAILED: 'Delete failed',
  USER_NOT_DELETE: 'User can not delete',
  CAN_NOT_DELETE_YOURSELF: 'Can not delete yourself',
  USER_NOT_UPDATE: 'User can not update',
  ROLE_EXIST: 'Role already exist',
  ROLE_NOT_FOUND: 'Role not found',
  USER_NOT_ACTIVE: 'User not active',

  WEBSITE_NOT_EXIST: 'Website is not exist',
  WEBSITE_NOT_FOUND: 'Website not found',

  USER_WEBSITE_NOT_EXIST: 'UserWebsite dose not exist',
  NOTIFY_NOT_FOUND: 'Notify not found',
  NOTIFY_IS_NOT_ALLOW_UPDATE: 'Notify is not allowed to be update',
  SUGGEST_MUST_HAVE_LINK: 'Suggest must have link or Suggest is running',
  SUGGEST_NOT_EXIST: 'Suggest does not exist',
  SUGGEST_NOT_EXIST_IN_USER: 'Suggest does not exist in user',
  SUGGEST_NOT_EXIST_IN_LEADER: 'Suggest does not exist in leader',
  HISTORY_NOT_EXIST: 'History does not exist',
  LINK_NOT_EXIST: 'Link does not exist',
  USER_NOT_BELONG_TO_LEADER: 'User does not belong to the leaderId',
  USER_NOT_PERMISSION: 'User does not permission',

  GROUP_ID_TELEGRAM_REQUIRED: 'Group id telegram is required',
  USER_CANNOT_BE_USER_OWN_LEADER: 'User cannot be user own leader',

  //TelegramEntity
  TELEGRAMCONFIG_IS_NOT_ALLOW_UPDATE:
    'Telegramconfig is not allowed to be update',
  TELEGRAMCONFIG_NOT_EXITS: 'Telegramconfig does not exits',
  TELEGRAM_EXIST: 'Telegram already exists',
  USER_NOT_LEADER: 'User is not a leader',

  //Sinbyte
  SINBYRE_EXIST: 'Sinbyte already exists',
  SINBYTE_IS_NOT_ALLOW_UPDATE: 'Sinbyte is not allowed to be update',
  SINBYTE_NOT_EXITS: 'Sinbyte does not exits',
  PLEASE_CONFIG_SINBYTE: 'Please configure sinbyte before indexing',

  FILE_IS_REQUIRED: 'File is required',
  ONLY_EXCEL_FILE_ALLOWED: 'Only Excel files are allowed',
};
