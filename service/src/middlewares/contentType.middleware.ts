import { Request, Response, NextFunction } from 'express';
import { createLogger } from '@/config/logger';

const logger = createLogger('ContentType:Mw');

/**
 * Middleware pour valider que le Content-Type est application/json
 * pour les requêtes qui modifient des données (POST, PUT, PATCH)
 */
export const requireJsonContentType = (req: Request, res: Response, next: NextFunction): void => {
  // Vérifier uniquement pour les méthodes qui envoient un body
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');

    // Vérifier si le Content-Type contient application/json
    if (!contentType || !contentType.includes('application/json')) {
      logger.info('Content-Type invalide', {
        method: req.method,
        path: req.path,
        contentType: contentType || 'non défini',
      });
      res.status(415).json({
        error: 'Unsupported Media Type',
        message: 'Content-Type must be application/json',
      });
      return;
    }
  }

  next();
};
