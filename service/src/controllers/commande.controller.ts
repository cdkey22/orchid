import { Request, Response } from 'express';
import { CommandeService } from '@/services/commande.service';
import { generateError } from '@/controllers/types/api';
import {
  ClientId,
  Commande,
  CommandeCreationDate,
  CommandeId,
  CommandeStatus,
} from '@/models/commande';
import {
  CommandeCreationDateInFutureError,
  CommandeDaoError,
  CommandeNotFoundError,
  CommandeStatusInvalid,
} from '@/errors/commande.errors';
import { createLogger } from '@/config/logger';

const logger = createLogger('Commande:Ctrl');

const AUCUN_CLIENT_ID_N_EST_FOURNI = "Aucun clientId n'est fourni";
const LE_CLIENT_ID_FOURNI_EST_INVALIDE = 'Le clientId fourni est invalide';
const AUCUNE_DATE_N_EST_FOURNIE = "Aucune date n'est fournie";
const LA_DATE_FOURNIE_INVALIDE = 'La date fournie invalide';
const AUCUN_STATUT_N_EST_FOURNI = "Aucun statut n'est fourni";
const LE_STATUT_FOURNI_EST_INVALIDE = 'Le statut fourni est invalide';
const L_IDENTIFIANT_DE_COMMANDE_EST_INVALIDE = "L'identifiant de commande est invalide";

export class CommandeController {
  private commandeService: CommandeService;

  constructor() {
    this.commandeService = new CommandeService();
  }

  createCommande = async (req: Request, res: Response): Promise<void> => {
    logger.info('POST /commandes ...', { body: req.body });

    try {
      const { clientId, date } = req.body;

      if (null == clientId) {
        logger.info('POST /commandes [400] ', AUCUN_CLIENT_ID_N_EST_FOURNI);
        generateError(res, 400, AUCUN_CLIENT_ID_N_EST_FOURNI);
        return;
      }

      if (clientId <= 0) {
        logger.info('POST /commandes [400] ', LE_CLIENT_ID_FOURNI_EST_INVALIDE);
        generateError(res, 400, LE_CLIENT_ID_FOURNI_EST_INVALIDE);
        return;
      }

      if (!date) {
        logger.info('POST /commandes [400] ', AUCUNE_DATE_N_EST_FOURNIE);
        generateError(res, 400, AUCUNE_DATE_N_EST_FOURNIE);
        return;
      }

      const validDate = new Date(date);

      if (isNaN(validDate.getTime())) {
        logger.info('POST /commandes [400] ', LA_DATE_FOURNIE_INVALIDE);
        generateError(res, 400, LA_DATE_FOURNIE_INVALIDE);
        return;
      }

      const commande: Commande = await this.commandeService.createCommande(
        clientId as ClientId,
        validDate as CommandeCreationDate
      );

      res.status(201).json({
        id: commande.id,
      });
      logger.info('POST /commandes [201] Commande créée avec succès', {
        commandeId: commande.id,
        status: 201,
      });
    } catch (error) {
      this.handleError(res, error, 'POST /commandes');
    }
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    logger.info('PATCH /commandes/:id/status ...', {
      params: req.params,
      body: req.body,
    });

    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!id) {
        logger.info('PATCH /commandes/:id/status [400] ', L_IDENTIFIANT_DE_COMMANDE_EST_INVALIDE);
        generateError(res, 400, L_IDENTIFIANT_DE_COMMANDE_EST_INVALIDE);
        return;
      }

      const commandeId = parseInt(id, 10);

      if (isNaN(commandeId) || commandeId <= 0) {
        logger.info('PATCH /commandes/:id/status [400] ', L_IDENTIFIANT_DE_COMMANDE_EST_INVALIDE);
        generateError(res, 400, L_IDENTIFIANT_DE_COMMANDE_EST_INVALIDE);
        return;
      }

      if (null == status) {
        logger.info('PATCH /commandes/:id/status [400] ', AUCUN_STATUT_N_EST_FOURNI);
        generateError(res, 400, AUCUN_STATUT_N_EST_FOURNI);
        return;
      }

      if (!Object.values(CommandeStatus).includes(status)) {
        logger.info('PATCH /commandes/:id/status [400] ', LE_STATUT_FOURNI_EST_INVALIDE);
        generateError(res, 400, LE_STATUT_FOURNI_EST_INVALIDE);
        return;
      }

      await this.commandeService.updateStatus(commandeId as CommandeId, status as CommandeStatus);

      res.status(204).send();
      logger.info('PATCH /commandes/:id/status [204] Statut mis à jour avec succès');
    } catch (error) {
      this.handleError(res, error, 'PATCH /commandes/:id/status');
    }
  };

  private handleError(res: Response, error: unknown, context: string): void {
    if (error instanceof CommandeCreationDateInFutureError) {
      logger.warn(`${context} [400] `, { error: error.message });
      generateError(res, 400, error.message);
      return;
    }

    if (error instanceof CommandeStatusInvalid) {
      logger.warn(`${context} [400] `, { error: error.message });
      generateError(res, 400, error.message);
      return;
    }

    if (error instanceof CommandeNotFoundError) {
      logger.warn(`${context} [404] `, { error: error.message });
      generateError(res, 404, error.message);
      return;
    }

    if (error instanceof CommandeDaoError) {
      logger.error(`${context} [500] Erreur DAO`, {
        error: error.message,
        cause: error.cause.message,
      });
      generateError(res, 500, 'Une erreur est survenue lors du traitement de la commande');
      return;
    }

    logger.error(`${context} [500] Erreur inattendue`, { error: String(error) });
    generateError(res, 500, 'Une erreur inattendue est survenue');
  }
}
