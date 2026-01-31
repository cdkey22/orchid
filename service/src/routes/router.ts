import { Router } from 'express';
import { VersionController } from '@/controllers/version.controller';
import { CommandeController } from '@/controllers/commande.controller';

const router = Router();

/*----------------------------------------------------------------------------------------------------------------------
 * Mise en place d'un service pour connaitre la version du produit et de l'environnement
 *
 * Attention ce service peut poser des problèmes de sécurité.
 * Faire un audit DSI avant toute mise en production
 ---------------------------------------------------------------------------------------------------------------------*/

const versionController = new VersionController();
router.get('/version', versionController.getVersion);

/*----------------------------------------------------------------------------------------------------------------------
 * Routes pour la gestion des commandes
 ---------------------------------------------------------------------------------------------------------------------*/

const commandeController = new CommandeController();
router.post('/commandes', commandeController.createCommande);
router.patch('/commandes/:id/status', commandeController.updateStatus);

export default router;
