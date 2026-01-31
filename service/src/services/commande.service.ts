import { ClientId, Commande, CommandeCreationDate } from '@/models/commande';
import { BddCommandeDao } from '@/dao/bddCommande';
import { RabbitmqCommandeDao } from '@/dao/rabbitmqCommande';
import { RedisCommandeDao } from '@/dao/redisCommande';
import logger from '@/config/logger';

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
    logger.info('Service: Création commande ...', {
      clientId,
      creationDate: creationDate.toISOString(),
    });

    if (creationDate.getTime() > Date.now()) {
      logger.info('Service: Date de creation de commande incorecte');
      throw new Error('La date de création est dans le futur');
    }

    logger.debug('Service: Stockage dans la bdd ...');
    const commande = await this.bddCommandeDao.createCommande(clientId, creationDate);
    logger.info('Service: Commande créée', { commandeId: commande.id });

    await this.redisCommandeDao.setStatus(commande.id, commande.status);

    await this.rabbitmqCommandeDao.publishStatusChange(
      commande.id,
      commande.clientId,
      commande.status
    );

    return commande;
  }
}
