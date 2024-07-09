import { format, transports } from 'winston';

export const defineTransport = () => {
  return [
    new transports.File({
      filename: `logs/${new Date().toISOString().split('T')[0]}/error.log`,
      level: 'error',
      format: format.combine(format.timestamp(), format.json()),
    }),
    new transports.File({
      filename: `logs/${new Date().toISOString().split('T')[0]}/info.log`,
      level: 'info',
      format: format.combine(format.timestamp(), format.json()),
    }),
    new transports.File({
      filename: `logs/${new Date().toISOString().split('T')[0]}/warn.log`,
      level: 'warn',
      format: format.combine(format.timestamp(), format.json()),
    }),
    new transports.File({
      filename: `logs/${new Date().toISOString().split('T')[0]}/debug.log`,
      level: 'debug',
      format: format.combine(format.timestamp(), format.json()),
    }),
  ];
};
