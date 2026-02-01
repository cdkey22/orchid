import dotenv from 'dotenv';
dotenv.config();

import app from '@/app';
import { createLogger } from '@/config/logger';

const logger = createLogger('App');

const PORT = process.env.PORT || '3000';
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

logger.info('Initialisation du serveur', { port: PORT, apiPrefix: API_PREFIX });

app.listen(PORT, () => {
  logger.info('Serveur démarré', { port: PORT, url: `http://localhost:${PORT}${API_PREFIX}` });
});
