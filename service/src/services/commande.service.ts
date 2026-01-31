import { ClientId, Commande, CommandeCreationDate } from '@/models/commande';
import { BddCommandeService } from '@/dao/bddCommande';
import { RabbitmqCommandeService } from '@/dao/rabbitmqCommande';
import logger from '@/config/logger';

export class CommandeService {
  private bddCommandeService: BddCommandeService;
  private rabbitmqCommandeService: RabbitmqCommandeService;

  constructor() {
    this.bddCommandeService = new BddCommandeService();
    this.rabbitmqCommandeService = new RabbitmqCommandeService();
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
    const commande = await this.bddCommandeService.createCommande(clientId, creationDate);
    logger.info('Service: Commande créée', { commandeId: commande.id });

    await this.rabbitmqCommandeService.publishStatusChange(
      commande.id,
      commande.clientId,
      commande.status
    );

    return commande;
  }
}
