import { getRedisClient } from '@/config/redis';
import { createLogger } from '@/config/logger';
import { CommandeId, CommandeStatus } from '@/models/commande';

const logger = createLogger('Redis:DAO');

export class CommandeRedisDao {
  private getKey(commandeId: CommandeId): string {
    return `commande:${commandeId}:status`;
  }

  async setStatus(commandeId: CommandeId, status: CommandeStatus): Promise<void> {
    try {
      const client = await getRedisClient();
      const key = this.getKey(commandeId);

      await client.set(key, status);

      logger.info('Statut mis à jour', { commandeId, status, key });
    } catch (error) {
      logger.error('Erreur lors de la mise à jour du statut', {
        commandeId,
        status,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getStatus(commandeId: CommandeId): Promise<CommandeStatus | null> {
    try {
      const client = await getRedisClient();
      const key = this.getKey(commandeId);

      const status = await client.get(key);

      logger.debug('Statut récupéré', { commandeId, status, key });

      return status as CommandeStatus | null;
    } catch (error) {
      logger.error('Erreur lors de la récupération du statut', {
        commandeId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
