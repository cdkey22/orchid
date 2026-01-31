import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import versionRouter from '@/routes/router';
import { requireJsonContentType } from '@/middlewares/contentType.middleware';
import { createLogger } from '@/config/logger';

const logger = createLogger('App');

dotenv.config(); //Charge les variables d'environnement

const app: Application = express();
const PORT = process.env.PORT || '3000';
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

logger.info('Initialisation du serveur', { port: PORT, apiPrefix: API_PREFIX });

// Middlewares
app.use(helmet()); //Sécurisation des headers HTTP
app.use(cors()); //Gestion du Cross Domain Policy
app.use(requireJsonContentType); //Validation du Content-Type pour POST/PUT/PATCH
app.use(express.json()); //Permet la transformation du stream HTTP en du json (si content-type=application/json) de façon automatique

logger.debug('Middlewares chargés: helmet, cors, contentType, json');

// Routes
app.use(API_PREFIX, versionRouter);

logger.debug('Routes enregistrées');

// Démarrer le serveur
app.listen(PORT, () => {
  logger.info('Serveur démarré', { port: PORT, url: `http://localhost:${PORT}${API_PREFIX}` });
});

export default app;
