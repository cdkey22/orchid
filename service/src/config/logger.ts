import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, context, stack, ...metadata }) => {
  const contextPrefix = context ? `[${context}] ` : '';
  let log = `${timestamp} [${level}] ${contextPrefix}${message}`;

  if (Object.keys(metadata).length > 0) {
    log += ` ${JSON.stringify(metadata)}`;
  }

  if (stack) {
    log += `\n${stack}`;
  }

  return log;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
  ],
});

/**
 * Crée un logger avec un contexte (préfixe automatique)
 * @param context - Le contexte à afficher dans les logs (ex: 'Controller', 'Service', 'DAO')
 */
export const createLogger = (context: string) => logger.child({ context });