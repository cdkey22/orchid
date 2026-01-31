import { createClient, RedisClientType } from 'redis';
import { createLogger } from '@/config/logger';

const logger = createLogger('Redis:Cfg');

const REDIS_URL =
  process.env.REDIS_URL ||
  `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;

let client: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (client && client.isOpen) {
    return client;
  }

  try {
    logger.info('Connexion en cours...', {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
    });

    client = createClient({ url: REDIS_URL });

    client.on('error', (err: Error) => {
      logger.error('Erreur de connexion', { error: err.message });
    });

    client.on('connect', () => {
      logger.info('Connexion établie');
    });

    await client.connect();

    return client;
  } catch (error) {
    logger.error('Impossible de se connecter', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function closeRedis(): Promise<void> {
  try {
    if (client && client.isOpen) {
      await client.quit();
      client = null;
      logger.info('Connexion fermée proprement');
    }
  } catch (error) {
    logger.error('Erreur lors de la fermeture', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
