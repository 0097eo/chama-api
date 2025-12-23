import pino from 'pino';
import { Sentry } from '../instrument';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const logger = pino({
  level: isProduction ? 'info' : 'debug',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  hooks: {
    logMethod(inputArgs: any[], method: (...args: any[]) => void) {
      if (inputArgs[0] instanceof Error) {
        Sentry.captureException(inputArgs[0], {
          extra: { ...inputArgs[1] }
        });
      }
      return method.apply(this, inputArgs);
    }
  },
  ...(isProduction || isTest
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      }),
});

export default logger;