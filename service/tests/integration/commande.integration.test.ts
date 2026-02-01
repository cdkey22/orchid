import request from 'supertest';
import express, { Application } from 'express';
import { CommandeController } from '@/controllers/commande.controller';
import { CommandeService } from '@/services/commande.service';
import { CommandeBddDao } from '@/dao/commande/bdd';
import { CommandeRabbitmqDao } from '@/dao/commande/rabbitmq';
import { CommandeRedisDao } from '@/dao/commande/redis';
import {
  cleanDatabase,
  consumeMessage,
  getTestPool,
  getRedisValue,
  flushRedis,
  purgeQueue,
  startAllContainers,
  stopAllContainers,
} from './setup/testcontainers.setup';

const QUEUE_NAME = 'order.notifications';

// Mock du pool MySQL pour utiliser le pool de testcontainers
jest.mock('@/config/database', () => ({
  get pool() {
    return getTestPool();
  },
}));

// Mock de la config RabbitMQ pour utiliser le conteneur de test
jest.mock('@/config/rabbitmq', () => {
  const originalModule = jest.requireActual('@/config/rabbitmq');
  let testChannel: any = null;

  return {
    ...originalModule,
    getRabbitMQChannel: jest.fn(async () => {
      if (testChannel) {
        return testChannel;
      }

      const amqplib = require('amqplib');
      const { getRabbitMQUrl } = require('./setup/testcontainers.setup');
      const connection = await amqplib.connect(getRabbitMQUrl());
      testChannel = await connection.createChannel();
      return testChannel;
    }),
  };
});

// Mock de la config Redis pour utiliser le conteneur de test
jest.mock('@/config/redis', () => {
  const originalModule = jest.requireActual('@/config/redis');

  return {
    ...originalModule,
    getRedisClient: jest.fn(async () => {
      const { getTestRedisClient } = require('./setup/testcontainers.setup');
      return getTestRedisClient();
    }),
  };
});

describe('Commande API', () => {
  let app: Application;
  let commandeController: CommandeController;

  beforeAll(async () => {
    // Démarrer tous les conteneurs en parallèle
    await startAllContainers();

    // Créer l'application Express
    app = express();
    app.use(express.json());

    // Créer les vraies instances
    const bddCommandeDao = new CommandeBddDao();
    const rabbitmqCommandeDao = new CommandeRabbitmqDao();
    const redisCommandeDao = new CommandeRedisDao();
    const commandeService = new CommandeService();
    (commandeService as any).bddCommandeDao = bddCommandeDao;
    (commandeService as any).rabbitmqCommandeDao = rabbitmqCommandeDao;
    (commandeService as any).redisCommandeDao = redisCommandeDao;

    commandeController = new CommandeController();
    (commandeController as any).commandeService = commandeService;

    app.post('/api/v1/commandes', commandeController.createCommande);
    app.patch('/api/v1/commandes/:id/status', commandeController.updateStatus);
  }, 180000);

  afterAll(async () => {
    await stopAllContainers();
  }, 60000);

  beforeEach(async () => {
    await cleanDatabase();
    await purgeQueue(QUEUE_NAME);
    await flushRedis();
  });

  describe('POST /api/v1/commandes', () => {
    describe('Création de commande réussie', () => {
    it('devrait créer une commande avec toutes les persistances', async () => {
      const requestData = {
        clientId: 123,
        date: '2024-01-15T10:00:00.000Z',
      };

      // Appel REST
      const response = await request(app).post('/api/v1/commandes').send(requestData).expect(201);

      expect(response.body).toHaveProperty('id');
      const commandeId = response.body.id;

      // Vérification MySQL - orders
      const pool = getTestPool();
      const connection = await pool.getConnection();
      const [orders]: any[] = await connection.execute('SELECT * FROM orders WHERE id = ?', [
        commandeId,
      ]);
      expect(orders.length).toBe(1);
      expect(orders[0].client_id).toBe(123);
      expect(orders[0].status).toBe('RECEIVED');

      // Vérification MySQL - order_history
      const [history]: any[] = await connection.execute(
        'SELECT * FROM order_history WHERE order_id = ?',
        [commandeId]
      );
      connection.release();
      expect(history.length).toBe(1);
      expect(history[0].status).toBe('RECEIVED');

      // Vérification Redis
      const redisStatus = await getRedisValue(`commande:${commandeId}:status`);
      expect(redisStatus).toBe('RECEIVED');

      // Vérification RabbitMQ
      const message = await consumeMessage(QUEUE_NAME);
      expect(message).not.toBeNull();
      expect(message.clientId).toBe(123);
      expect(message.commandeId).toBe(parseInt(commandeId));
      expect(message.status).toBe('RECEIVED');
    });
  });

  describe('Validation des erreurs', () => {
    it('devrait retourner 400 si clientId est manquant - aucune persistance', async () => {
      const requestData = {
        date: '2024-01-15T10:00:00.000Z',
      };

      // Appel REST
      const response = await request(app).post('/api/v1/commandes').send(requestData).expect(400);

      expect(response.body.message).toBe("Aucun clientId n'est fourni");

      // Vérification MySQL - aucune donnée
      const pool = getTestPool();
      const connection = await pool.getConnection();
      const [orders]: any[] = await connection.execute('SELECT * FROM orders');
      const [history]: any[] = await connection.execute('SELECT * FROM order_history');
      connection.release();
      expect(orders.length).toBe(0);
      expect(history.length).toBe(0);

      // Vérification RabbitMQ - aucun message
      const message = await consumeMessage(QUEUE_NAME);
      expect(message).toBeNull();
    });

    it('devrait retourner 400 si clientId est invalide - aucune persistance', async () => {
      const requestData = {
        clientId: 0,
        date: '2024-01-15T10:00:00.000Z',
      };

      // Appel REST
      const response = await request(app).post('/api/v1/commandes').send(requestData).expect(400);

      expect(response.body.message).toBe('Le clientId fourni est invalide');

      // Vérification MySQL - aucune donnée
      const pool = getTestPool();
      const connection = await pool.getConnection();
      const [orders]: any[] = await connection.execute('SELECT * FROM orders');
      connection.release();
      expect(orders.length).toBe(0);

      // Vérification RabbitMQ - aucun message
      const message = await consumeMessage(QUEUE_NAME);
      expect(message).toBeNull();
    });

    it('devrait retourner 400 si date est manquante - aucune persistance', async () => {
      const requestData = {
        clientId: 123,
      };

      // Appel REST
      const response = await request(app).post('/api/v1/commandes').send(requestData).expect(400);

      expect(response.body.message).toBe("Aucune date n'est fournie");

      // Vérification MySQL - aucune donnée
      const pool = getTestPool();
      const connection = await pool.getConnection();
      const [orders]: any[] = await connection.execute('SELECT * FROM orders');
      connection.release();
      expect(orders.length).toBe(0);

      // Vérification RabbitMQ - aucun message
      const message = await consumeMessage(QUEUE_NAME);
      expect(message).toBeNull();
    });

    it('devrait retourner 400 si date est invalide - aucune persistance', async () => {
      const requestData = {
        clientId: 123,
        date: 'not-a-date',
      };

      // Appel REST
      const response = await request(app).post('/api/v1/commandes').send(requestData).expect(400);

      expect(response.body.message).toBe('La date fournie invalide');

      // Vérification MySQL - aucune donnée
      const pool = getTestPool();
      const connection = await pool.getConnection();
      const [orders]: any[] = await connection.execute('SELECT * FROM orders');
      connection.release();
      expect(orders.length).toBe(0);

      // Vérification RabbitMQ - aucun message
      const message = await consumeMessage(QUEUE_NAME);
      expect(message).toBeNull();
    });

    it('devrait retourner 400 si date est dans le futur - aucune persistance', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const requestData = {
        clientId: 123,
        date: futureDate,
      };

      // Appel REST
      const response = await request(app).post('/api/v1/commandes').send(requestData).expect(400);

      expect(response.body.message).toBe('La date de création est dans le futur');

      // Vérification MySQL - aucune donnée
      const pool = getTestPool();
      const connection = await pool.getConnection();
      const [orders]: any[] = await connection.execute('SELECT * FROM orders');
      connection.release();
      expect(orders.length).toBe(0);

      // Vérification RabbitMQ - aucun message
      const message = await consumeMessage(QUEUE_NAME);
      expect(message).toBeNull();
    });
    });
  });

  describe('PATCH /api/v1/commandes/:id/status', () => {
    const createTestCommande = async (): Promise<number> => {
      const response = await request(app)
        .post('/api/v1/commandes')
        .send({
          clientId: 123,
          date: '2024-01-15T10:00:00.000Z',
        })
        .expect(201);

      // Purger le message de création avant les tests de mise à jour
      await consumeMessage(QUEUE_NAME);
      return response.body.id;
    };

    describe('Mise à jour réussie', () => {
      it('devrait mettre à jour le statut avec toutes les persistances', async () => {
        const commandeId = await createTestCommande();

        // Appel REST
        await request(app)
          .patch(`/api/v1/commandes/${commandeId}/status`)
          .send({ status: 'PAID' })
          .expect(204);

        // Vérification MySQL - orders
        const pool = getTestPool();
        const connection = await pool.getConnection();
        const [orders]: any[] = await connection.execute('SELECT * FROM orders WHERE id = ?', [
          commandeId,
        ]);
        expect(orders[0].status).toBe('PAID');

        // Vérification MySQL - order_history (2 entrées : RECEIVED + PAID)
        const [history]: any[] = await connection.execute(
          'SELECT * FROM order_history WHERE order_id = ? ORDER BY change_date',
          [commandeId]
        );
        connection.release();
        expect(history.length).toBe(2);
        expect(history[0].status).toBe('RECEIVED');
        expect(history[1].status).toBe('PAID');

        // Vérification Redis
        const redisStatus = await getRedisValue(`commande:${commandeId}:status`);
        expect(redisStatus).toBe('PAID');

        // Vérification RabbitMQ
        const message = await consumeMessage(QUEUE_NAME);
        expect(message).not.toBeNull();
        expect(message.commandeId).toBe(commandeId);
        expect(message.status).toBe('PAID');
      });

      it('devrait permettre plusieurs mises à jour successives', async () => {
        const commandeId = await createTestCommande();

        // Mise à jour vers PAID
        await request(app)
          .patch(`/api/v1/commandes/${commandeId}/status`)
          .send({ status: 'PAID' })
          .expect(204);
        await consumeMessage(QUEUE_NAME);

        // Mise à jour vers PREPARING
        await request(app)
          .patch(`/api/v1/commandes/${commandeId}/status`)
          .send({ status: 'PREPARING' })
          .expect(204);
        await consumeMessage(QUEUE_NAME);

        // Mise à jour vers SENT
        await request(app)
          .patch(`/api/v1/commandes/${commandeId}/status`)
          .send({ status: 'SENT' })
          .expect(204);

        // Vérification MySQL - order_history (4 entrées)
        const pool = getTestPool();
        const connection = await pool.getConnection();
        const [history]: any[] = await connection.execute(
          'SELECT * FROM order_history WHERE order_id = ? ORDER BY change_date',
          [commandeId]
        );
        connection.release();
        expect(history.length).toBe(4);
        expect(history.map((h: any) => h.status)).toEqual(['RECEIVED', 'PAID', 'PREPARING', 'SENT']);
      });

      it('devrait retourner 400 si le workflow de statut est invalide', async () => {
        const commandeId = await createTestCommande();

        // Mise à jour vers PAID
        await request(app)
          .patch(`/api/v1/commandes/${commandeId}/status`)
          .send({ status: 'PAID' })
          .expect(204);
        await consumeMessage(QUEUE_NAME);

        // Tentative de retour vers RECEIVED (invalide)
        const response = await request(app)
          .patch(`/api/v1/commandes/${commandeId}/status`)
          .send({ status: 'RECEIVED' })
          .expect(400);

        expect(response.body.message).toBe('Le status voulu pour la commande est invalide');
      });
    });

    describe('Validation des erreurs', () => {
      it('devrait retourner 404 si la commande n\'existe pas', async () => {
        const response = await request(app)
          .patch('/api/v1/commandes/99999/status')
          .send({ status: 'PAID' })
          .expect(404);

        expect(response.body.message).toBe('Commande 99999 non trouvée');
      });

      it('devrait retourner 400 si le statut est manquant', async () => {
        const commandeId = await createTestCommande();

        const response = await request(app)
          .patch(`/api/v1/commandes/${commandeId}/status`)
          .send({})
          .expect(400);

        expect(response.body.message).toBe("Aucun statut n'est fourni");
      });

      it('devrait retourner 400 si le statut est invalide', async () => {
        const commandeId = await createTestCommande();

        const response = await request(app)
          .patch(`/api/v1/commandes/${commandeId}/status`)
          .send({ status: 'INVALID_STATUS' })
          .expect(400);

        expect(response.body.message).toBe('Le statut fourni est invalide');
      });

      it('devrait retourner 400 si l\'id est invalide', async () => {
        const response = await request(app)
          .patch('/api/v1/commandes/invalid/status')
          .send({ status: 'PAID' })
          .expect(400);

        expect(response.body.message).toBe("L'identifiant de commande est invalide");
      });
    });
  });
});
