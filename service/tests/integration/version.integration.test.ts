import request from 'supertest';
import express, { Application } from 'express';
import { VersionController } from '@/controllers/version.controller';

describe('Version Integration Tests - Top to Bottom', () => {
  let app: Application;

  beforeAll(() => {
    // Créer l'application Express
    app = express();
    app.use(express.json());

    // Créer le controller
    const versionController = new VersionController();

    // Enregistrer la route
    app.get('/api/v1/version', versionController.getVersion);
  });

  describe('GET /api/v1/version', () => {
    it('devrait retourner les informations de version', async () => {
      const response = await request(app).get('/api/v1/version').expect(200);

      expect(response.body).toHaveProperty('name', 'orchid');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('nodeVersion');
      expect(response.body).toHaveProperty('environment');
    });

  });
});
