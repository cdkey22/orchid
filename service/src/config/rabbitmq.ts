import amqplib from 'amqplib';
import { createLogger } from '@/config/logger';

const logger = createLogger('RabbitMQ:Cfg');

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  `amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_HOST}:${process.env.RABBITMQ_PORT}`;

export const rabbitmqConfig = {
  queues: {
    commandeStatusChanged: process.env.RABBITMQ_QUEUE_COMMANDE_STATUS || 'order.notifications',
  },
};

let connection: amqplib.ChannelModel | null = null;
let channel: amqplib.Channel | null = null;

export async function getRabbitMQChannel(): Promise<amqplib.Channel> {
  if (channel) {
    return channel;
  }

  try {
    logger.info('Connexion en cours...', {
      host: process.env.RABBITMQ_HOST,
      port: process.env.RABBITMQ_PORT,
    });

    connection = await amqplib.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    connection.on('error', (err: Error) => {
      logger.error('Erreur de connexion', { error: err.message });
      channel = null;
      connection = null;
    });

    connection.on('close', () => {
      logger.warn('Connexion fermée');
      channel = null;
      connection = null;
    });

    logger.info('Connexion établie');
    return channel;
  } catch (error) {
    logger.error('Impossible de se connecter', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function closeRabbitMQ(): Promise<void> {
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }
    if (connection) {
      await connection.close();
      connection = null;
    }
    logger.info('Connexion fermée proprement');
  } catch (error) {
    logger.error('Erreur lors de la fermeture', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
