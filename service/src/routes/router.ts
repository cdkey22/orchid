import { Router } from 'express';
import { VersionController } from '@/controllers/version.controller';

const router = Router();

/*----------------------------------------------------------------------------------------------------------------------
 * Mise en place d'un service pour connaitre la version du produit et de l'environnement
 *
 * Attention ce service peut poser des problèmes de sécurité.
 * Faire un audit DSI avant toute mise en production
 ---------------------------------------------------------------------------------------------------------------------*/

const versionController = new VersionController();
router.get('/version', versionController.getVersion);

export default router;
