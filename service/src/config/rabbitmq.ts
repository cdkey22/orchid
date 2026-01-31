import amqplib from 'amqplib';
import logger from '@/config/logger';

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  `amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_HOST}:${process.env.RABBITMQ_PORT}`;

export const rabbitmqConfig = {
  queues: {
    commandeStatusChanged: process.env.RABBITMQ_QUEUE_COMMANDE_STATUS || 'commande.status.changed',
  },
};

let connection: amqplib.ChannelModel | null = null;
let channel: amqplib.Channel | null = null;

export async function getRabbitMQChannel(): Promise<amqplib.Channel> {
  if (channel) {
    return channel;
  }

  try {
    logger.info('RabbitMQ: Connexion en cours...', {
      host: process.env.RABBITMQ_HOST,
      port: process.env.RABBITMQ_PORT,
    });

    connection = await amqplib.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    connection.on('error', (err: Error) => {
      logger.error('RabbitMQ: Erreur de connexion', { error: err.message });
      channel = null;
      connection = null;
    });

    connection.on('close', () => {
      logger.warn('RabbitMQ: Connexion fermée');
      channel = null;
      connection = null;
    });

    logger.info('RabbitMQ: Connexion établie');
    return channel;
  } catch (error) {
    logger.error('RabbitMQ: Impossible de se connecter', {
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
    logger.info('RabbitMQ: Connexion fermée proprement');
  } catch (error) {
    logger.error('RabbitMQ: Erreur lors de la fermeture', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
