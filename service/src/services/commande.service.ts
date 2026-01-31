import {
  ClientId,
  Commande,
  CommandeCreationDate,
  CommandeId,
  CommandeStatus,
} from '@/models/commande';
import { BddCommandeDao } from '@/dao/bddCommande';
import { RabbitmqCommandeDao } from '@/dao/rabbitmqCommande';
import { RedisCommandeDao } from '@/dao/redisCommande';
import {
  CommandeCreationDateInFutureError,
  CommandeDaoError,
  CommandeNotFoundError,
  CommandeStatusInvalid,
} from '@/errors/commande.errors';
import { createLogger } from '@/config/logger';

const logger = createLogger('Commande:Svc');

const statusWorkflow: CommandeStatus[] = [
  CommandeStatus.RECEIVED,
  CommandeStatus.PAID,
  CommandeStatus.PREPARING,
  CommandeStatus.SENT,
];

export class CommandeService {
  private bddCommandeDao: BddCommandeDao;
  private rabbitmqCommandeDao: RabbitmqCommandeDao;
  private redisCommandeDao: RedisCommandeDao;

  constructor() {
    this.bddCommandeDao = new BddCommandeDao();
    this.rabbitmqCommandeDao = new RabbitmqCommandeDao();
    this.redisCommandeDao = new RedisCommandeDao();
  }

  async createCommande(clientId: ClientId, creationDate: CommandeCreationDate): Promise<Commande> {
    logger.info('Création commande ...', {
      clientId,
      creationDate: creationDate.toISOString(),
    });

    if (creationDate.getTime() > Date.now()) {
      logger.info('Date de création de commande incorrecte');
      throw new CommandeCreationDateInFutureError();
    }

    try {
      logger.debug('Stockage dans la bdd ...');
      const commande = await this.bddCommandeDao.createCommande(clientId, creationDate);
      logger.info('Commande créée', { commandeId: commande.id });

      await this.redisCommandeDao.setStatus(commande.id, commande.status);

      await this.rabbitmqCommandeDao.publishStatusChange(
        commande.id,
        commande.clientId,
        commande.status
      );

      return commande;
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Erreur lors de la création de la commande', {
          error: error.message,
        });
        throw new CommandeDaoError('la création de la commande', error);
      }
      throw error;
    }
  }

  /**
   * Le code du workflow est trop simple pour mettre en place un StateMachine pattern. Si il devait évoluer cela pourrait être fait ici.
   * @param commande
   * @param newStatus
   * @private
   */
  private processStatusWorkflow(commande: Commande, newStatus: CommandeStatus) {
    const currentStatusIndex = statusWorkflow.indexOf(commande.status);
    const nextStatusIndex = statusWorkflow.indexOf(newStatus);

    if (currentStatusIndex > nextStatusIndex) {
      throw new CommandeStatusInvalid();
    }
  }

  async updateStatus(commandeId: CommandeId, status: CommandeStatus): Promise<Commande> {
    logger.info('Mise à jour statut commande ...', {
      commandeId,
      status,
    });

    try {
      logger.debug('Récupération de la commande ...');
      const commande = await this.bddCommandeDao.findById(commandeId);

      if (!commande) {
        logger.info('Commande non trouvée', { commandeId });
        throw new CommandeNotFoundError(commandeId);
      }

      this.processStatusWorkflow(commande, status);

      logger.debug('Mise à jour dans la bdd ...');
      await this.bddCommandeDao.updateStatus(commandeId, status);
      logger.info('Statut mis à jour', { commandeId, status });

      await this.redisCommandeDao.setStatus(commandeId, status);

      await this.rabbitmqCommandeDao.publishStatusChange(commande.id, commande.clientId, status);

      return {
        ...commande,
        status,
      };
    } catch (error) {
      if (error instanceof CommandeNotFoundError || error instanceof CommandeStatusInvalid) {
        throw error;
      }
      if (error instanceof Error) {
        logger.error('Erreur lors de la mise à jour du statut', { error: error.message });
        throw new CommandeDaoError('la mise à jour du statut', error);
      }
      throw error;
    }
  }
}
