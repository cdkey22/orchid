import { pool } from '@/config/database';
import logger from '@/config/logger';
import {
  ClientId,
  Commande,
  CommandeCreationDate,
  CommandeId,
  CommandeStatus,
} from '@/models/commande';
import { ResultSetHeader } from 'mysql2';

export class BddCommandeService {
  async createCommande(clientId: ClientId, creationDate: CommandeCreationDate): Promise<Commande> {
    logger.debug('DAO: Acquisition connexion depuis le pool', { clientId });
    const connection = await pool.getConnection();

    try {
      logger.debug('DAO: Début de transaction');
      await connection.beginTransaction();

      const status = CommandeStatus.RECEIVED;

      logger.debug('DAO: Insertion commande dans orders', { clientId, status, creationDate });
      const [result] = await connection.execute<ResultSetHeader>(
        'INSERT INTO orders (client_id, status, creation_date) VALUES (?, ?, ?)',
        [clientId, status, creationDate]
      );

      const commandeId: CommandeId = result.insertId as CommandeId;

      logger.debug('DAO: Insertion historique dans order_history', { commandeId, status });
      await connection.execute('INSERT INTO order_history (order_id, status) VALUES (?, ?)', [
        commandeId,
        status,
      ]);

      await connection.commit();
      logger.info('DAO: Commande créée avec succès', { commandeId, clientId });

      return {
        id: commandeId,
        clientId: clientId,
        status,
        creationDate: creationDate,
      };
    } catch (error) {
      await connection.rollback();
      logger.error('DAO: Erreur lors de la création de la commande, rollback effectué', {
        clientId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      connection.release();
      logger.debug('DAO: Connexion libérée');
    }
  }
}
