import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import versionRouter from '@/routes/router';
import { requireJsonContentType } from '@/middlewares/contentType.middleware';
import { createLogger } from '@/config/logger';

const logger = createLogger('App');

const app: Application = express();
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

// Middlewares
app.use(helmet());
app.use(cors());
app.use(requireJsonContentType);
app.use(express.json());

logger.debug('Middlewares chargés: helmet, cors, contentType, json');

// Routes
app.use(API_PREFIX, versionRouter);

logger.debug('Routes enregistrées');

export default app;
