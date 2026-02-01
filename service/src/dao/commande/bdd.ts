import { pool } from '@/config/database';
import { createLogger } from '@/config/logger';

const logger = createLogger('MySQL:DAO');
import {
  ClientId,
  Commande,
  CommandeCreationDate,
  CommandeId,
  CommandeStatus,
} from '@/models/commande';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export class CommandeBddDao {
  async createCommande(clientId: ClientId, creationDate: CommandeCreationDate): Promise<Commande> {
    logger.debug('Acquisition connexion depuis le pool', { clientId });
    const connection = await pool.getConnection();

    try {
      logger.debug('Début de transaction');
      await connection.beginTransaction();

      const status = CommandeStatus.RECEIVED;

      logger.debug('Insertion commande dans orders', { clientId, status, creationDate });
      const [result] = await connection.execute<ResultSetHeader>(
        'INSERT INTO orders (client_id, status, creation_date) VALUES (?, ?, ?)',
        [clientId, status, creationDate]
      );

      const commandeId: CommandeId = result.insertId as CommandeId;

      logger.debug('Insertion historique dans order_history', { commandeId, status });
      await connection.execute('INSERT INTO order_history (order_id, status) VALUES (?, ?)', [
        commandeId,
        status,
      ]);

      await connection.commit();
      logger.info('Commande créée avec succès', { commandeId, clientId });

      return {
        id: commandeId,
        clientId: clientId,
        status,
        creationDate: creationDate,
      };
    } catch (error) {
      await connection.rollback();
      logger.error('Erreur lors de la création de la commande, rollback effectué', {
        clientId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      connection.release();
      logger.debug('Connexion libérée');
    }
  }

  async findById(commandeId: CommandeId): Promise<Commande | null> {
    logger.debug('Recherche commande par id', { commandeId });
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute<RowDataPacket[]>(
        'SELECT id, client_id, status, creation_date FROM orders WHERE id = ?',
        [commandeId]
      );

      const row = rows[0];

      if (!row) {
        logger.debug('Commande non trouvée', { commandeId });
        return null;
      }

      logger.debug('Commande trouvée', { commandeId });
      return {
        id: row.id as CommandeId,
        clientId: row.client_id as ClientId,
        status: row.status as CommandeStatus,
        creationDate: row.creation_date as CommandeCreationDate,
      };
    } finally {
      connection.release();
      logger.debug('Connexion libérée');
    }
  }

  async updateStatus(commandeId: CommandeId, status: CommandeStatus): Promise<void> {
    logger.debug('Acquisition connexion depuis le pool', { commandeId });
    const connection = await pool.getConnection();

    try {
      logger.debug('Début de transaction');
      await connection.beginTransaction();

      logger.debug('Mise à jour statut dans orders', { commandeId, status });
      await connection.execute('UPDATE orders SET status = ? WHERE id = ?', [status, commandeId]);

      logger.debug('Insertion historique dans order_history', { commandeId, status });
      await connection.execute('INSERT INTO order_history (order_id, status) VALUES (?, ?)', [
        commandeId,
        status,
      ]);

      await connection.commit();
      logger.info('Statut mis à jour avec succès', { commandeId, status });
    } catch (error) {
      await connection.rollback();
      logger.error('Erreur lors de la mise à jour du statut, rollback effectué', {
        commandeId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      connection.release();
      logger.debug('Connexion libérée');
    }
  }
}
