import { getRabbitMQChannel, rabbitmqConfig } from '@/config/rabbitmq';
import { createLogger } from '@/config/logger';
import { ClientId, CommandeId, CommandeStatus } from '@/models/commande';

const logger = createLogger('RabbitMQ:DAO');

const QUEUE_NAME = rabbitmqConfig.queues.commandeStatusChanged;

export interface CommandeStatusMessage {
  clientId: number;
  commandeId: number;
  status: CommandeStatus;
}

export class CommandeRabbitmqDao {
  async publishStatusChange(
    commandeId: CommandeId,
    clientId: ClientId,
    status: CommandeStatus
  ): Promise<void> {
    try {
      const channel = await getRabbitMQChannel();

      await channel.assertQueue(QUEUE_NAME, { durable: true });

      const message: CommandeStatusMessage = {
        clientId: clientId as number,
        commandeId: commandeId as number,
        status,
      };

      const messageBuffer = Buffer.from(JSON.stringify(message));

      channel.sendToQueue(QUEUE_NAME, messageBuffer, { persistent: true });

      logger.info('Message publié', {
        queue: QUEUE_NAME,
        commandeId,
        clientId,
        status,
      });
    } catch (error) {
      logger.error('Erreur lors de la publication du message', {
        commandeId,
        clientId,
        status,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
