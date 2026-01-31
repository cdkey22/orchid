import request from 'supertest';
import express, { Application } from 'express';
import { CommandeController } from '@/controllers/commande.controller';
import { CommandeService } from '@/services/commande.service';
import { BddCommandeService } from '@/dao/bddCommande';
import {
  startMySqlContainer,
  stopMySqlContainer,
  cleanDatabase,
  getTestPool,
} from './setup/testcontainers.setup';

// Mock du pool pour utiliser le pool de testcontainers
jest.mock('@/config/database', () => ({
  get pool() {
    return getTestPool();
  },
}));

describe('Commande Integration Tests - Top to Bottom avec MySQL Testcontainers', () => {
  let app: Application;

  beforeAll(async () => {
    // Démarrer le conteneur MySQL
    await startMySqlContainer();

    // Créer l'application Express
    app = express();
    app.use(express.json());

    // Créer les vraies instances (pas de mocks)
    const bddCommandeService = new BddCommandeService();
    const commandeService = new CommandeService();
    (commandeService as any).bddCommandeService = bddCommandeService;

    const commandeController = new CommandeController();
    (commandeController as any).commandeService = commandeService;

    // Enregistrer les routes
    app.post('/api/v1/commandes', commandeController.createCommande);
  }, 120000); // Timeout de 2 minutes pour le démarrage du conteneur

  afterAll(async () => {
    await stopMySqlContainer();
  }, 60000);

  beforeEach(async () => {
    await cleanDatabase();
    await checkDatabaseIsEmpty();
  });

  async function checkDatabaseIsEmpty() {
    // Vérifier qu'aucune donnée n'est en base
    const pool = getTestPool();
    const connection = await pool.getConnection();
    const [orders]: any[] = await connection.execute('SELECT * FROM orders');
    const [history]: any[] = await connection.execute('SELECT * FROM order_history');
    connection.release();

    expect(orders.length).toBe(0);
    expect(history.length).toBe(0);
  }

  describe('POST /api/v1/commandes', () => {
    it('devrait créer une commande et son historique dans MySQL', async () => {
      const requestData = {
        clientId: 123,
        date: '2024-01-15T10:00:00.000Z',
      };

      const response = await request(app).post('/api/v1/commandes').send(requestData).expect(201);

      // Vérifier la réponse HTTP
      expect(response.body).toHaveProperty('id');

      // Vérifier l'insertion en base de données
      const pool = getTestPool();
      const connection = await pool.getConnection();

      const [orders]: any[] = await connection.execute('SELECT * FROM orders WHERE id = ?', [
        response.body.id,
      ]);
      const [history]: any[] = await connection.execute(
        'SELECT * FROM order_history WHERE order_id = ?',
        [response.body.id]
      );

      connection.release();

      expect(orders.length).toBe(1);
      expect(orders[0].client_id).toBe(123);
      expect(orders[0].status).toBe('RECEIVED');

      expect(history.length).toBe(1);
      expect(history[0].status).toBe('RECEIVED');
    });

    it('devrait créer plusieurs commandes pour le même client', async () => {
      const commande1 = {
        clientId: 456,
        date: '2024-01-15T10:00:00.000Z',
      };

      const commande2 = {
        clientId: 456,
        date: '2024-01-16T11:00:00.000Z',
      };

      const response1 = await request(app).post('/api/v1/commandes').send(commande1).expect(201);
      const response2 = await request(app).post('/api/v1/commandes').send(commande2).expect(201);

      expect(response1.body.id).not.toBe(response2.body.id);
      expect(response1.body.clientId).toBe(response2.body.clientId);

      // Vérifier en base
      const pool = getTestPool();
      const connection = await pool.getConnection();

      const [orders]: any[] = await connection.execute(
        'SELECT * FROM orders WHERE client_id = ?',
        [456]
      );

      connection.release();

      expect(orders.length).toBe(2);
    });

    describe("Validation des cas d'erreurs", () => {
      it('devrait retourner 400 si clientId est manquant', async () => {
        const requestData = {
          date: '2024-01-15T10:00:00.000Z',
        };

        const response = await request(app).post('/api/v1/commandes').send(requestData).expect(400);

        expect(response.body.message).toBe("Aucun clientId n'est fourni");
        await checkDatabaseIsEmpty();
      });

      it('devrait retourner 400 si clientId est invalide', async () => {
        const requestData = {
          clientId: 0,
          date: '2024-01-15T10:00:00.000Z',
        };

        await request(app).post('/api/v1/commandes').send(requestData).expect(400);
        await checkDatabaseIsEmpty();
      });

      it('devrait retourner 400 si la date est dans le futur', async () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString();
        const requestData = {
          clientId: 123,
          date: futureDate,
        };

        const response = await request(app).post('/api/v1/commandes').send(requestData).expect(400);

        expect(response.body.message).toBe('La date de création est dans le futur');
        await checkDatabaseIsEmpty();
      });
    });
  });
});
