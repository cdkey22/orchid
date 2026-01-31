import request from 'supertest';
import express, { Application } from 'express';
import { CommandeController } from '@/controllers/commande.controller';
import { CommandeService } from '@/services/commande.service';
import { BddCommandeDao } from '@/dao/bddCommande';
import { RabbitmqCommandeDao } from '@/dao/rabbitmqCommande';
import { RedisCommandeDao } from '@/dao/redisCommande';
import {
  cleanDatabase,
  consumeMessage,
  getTestPool,
  getRedisValue,
  flushRedis,
  purgeQueue,
  startMySqlContainer,
  startRabbitMQContainer,
  startRedisContainer,
  stopMySqlContainer,
  stopRabbitMQContainer,
  stopRedisContainer,
} from './setup/testcontainers.setup';

const QUEUE_NAME = 'commande.status.changed';

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

describe('POST /api/v1/commandes', () => {
  let app: Application;

  beforeAll(async () => {
    // Démarrer les conteneurs
    await startMySqlContainer();
    await startRabbitMQContainer();
    await startRedisContainer();

    // Créer l'application Express
    app = express();
    app.use(express.json());

    // Créer les vraies instances
    const bddCommandeDao = new BddCommandeDao();
    const rabbitmqCommandeDao = new RabbitmqCommandeDao();
    const redisCommandeDao = new RedisCommandeDao();
    const commandeService = new CommandeService();
    (commandeService as any).bddCommandeDao = bddCommandeDao;
    (commandeService as any).rabbitmqCommandeDao = rabbitmqCommandeDao;
    (commandeService as any).redisCommandeDao = redisCommandeDao;

    const commandeController = new CommandeController();
    (commandeController as any).commandeService = commandeService;

    app.post('/api/v1/commandes', commandeController.createCommande);
  }, 180000);

  afterAll(async () => {
    await stopRedisContainer();
    await stopRabbitMQContainer();
    await stopMySqlContainer();
  }, 60000);

  beforeEach(async () => {
    await cleanDatabase();
    await purgeQueue(QUEUE_NAME);
    await flushRedis();
  });

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
