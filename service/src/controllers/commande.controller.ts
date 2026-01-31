import { Request, Response } from 'express';
import { CommandeService } from '@/services/commande.service';
import { generateError } from '@/controllers/types/api';
import { ClientId, Commande, CommandeCreationDate } from '@/models/commande';
import logger from '@/config/logger';

const AUCUN_CLIENT_ID_N_EST_FOURNI = "Aucun clientId n'est fourni";
const LE_CLIENT_ID_FOURNI_EST_INVALIDE = 'Le clientId fourni est invalide';
const AUCUNE_DATE_N_EST_FOURNIE = "Aucune date n'est fournie";
const LA_DATE_FOURNIE_INVALIDE = 'La date fournie invalide';

export class CommandeController {
  private commandeService: CommandeService;

  constructor() {
    this.commandeService = new CommandeService();
  }

  createCommande = async (req: Request, res: Response): Promise<void> => {
    logger.info('Controller: POST /commandes ...', { body: req.body });

    try {
      const { clientId, date } = req.body;

      if (null == clientId) {
        logger.info('Controller: POST /commandes [400] ', AUCUN_CLIENT_ID_N_EST_FOURNI);
        generateError(res, 400, AUCUN_CLIENT_ID_N_EST_FOURNI);
        return;
      }

      if (clientId <= 0) {
        logger.info('Controller: POST /commandes [400] ', LE_CLIENT_ID_FOURNI_EST_INVALIDE);
        generateError(res, 400, LE_CLIENT_ID_FOURNI_EST_INVALIDE);
        return;
      }

      if (!date) {
        logger.info('Controller: POST /commandes [400] ', AUCUNE_DATE_N_EST_FOURNIE);
        generateError(res, 400, AUCUNE_DATE_N_EST_FOURNIE);
        return;
      }

      const validDate = new Date(date);

      if (isNaN(validDate.getTime())) {
        logger.info('Controller: POST /commandes [400] ', LA_DATE_FOURNIE_INVALIDE);
        generateError(res, 400, LA_DATE_FOURNIE_INVALIDE);
        return;
      }

      const commande: Commande = await this.commandeService.createCommande(
        clientId as ClientId,
        validDate as CommandeCreationDate
      );


      res.status(201).json({
        id: commande.id
      });
      logger.info('POST /commandes [201] Commande créée avec succès', {
        commandeId: commande.id,
        status: 201,
      });

    } catch (error) {
      if (error instanceof Error) {
        logger.warn('POST /commandes [400] Erreur ', { error: error.message });
        generateError(res, 400, error.message);
      } else {
        logger.error('POST /commandes [500] Erreur inattendue', { error: String(error) });
        generateError(res, 500, 'Une erreur est servenu lors de la création de la commande ');
      }
    }
    return;
  };
}
