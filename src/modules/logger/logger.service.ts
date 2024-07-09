import {
  ConsoleLogger,
  Injectable,
  LoggerService,
  Scope,
} from '@nestjs/common';
import { createLogger } from 'winston';
import { defineTransport } from '../../utils/transports';

@Injectable({ scope: Scope.TRANSIENT })
export class MyLoggerService extends ConsoleLogger implements LoggerService {
  private logger = createLogger({
    transports: [...defineTransport()],
  });

  error(message: any, trace?: string, context?: string) {
    this.logger.error(message, { context });
    super.error(message, trace, context);
  }

  warn(message: any, context?: string) {
    this.logger.warn(message, { context });
    super.warn(message, context);
  }

  log(message: any, context?: string) {
    this.logger.info(message, { context });
    super.log(message, context);
  }

  debug(message: any, context?: string) {
    this.logger.debug(message, { context });
    super.debug(message, context);
  }

  verbose(message: any, context?: string) {
    super.verbose(message, context);
  }
}
