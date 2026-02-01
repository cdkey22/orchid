import request from 'supertest';
import app from '@/app';
import { testInfrastructure } from './support/infrastructure';
import { testFixtures } from './support/fixtures';

const QUEUE_NAME = 'order.notifications';

describe('Commande API', () => {
  beforeAll(async () => {
    await testInfrastructure.startAll();
  }, 180000);

  afterAll(async () => {
    await testInfrastructure.closeClients();
  }, 60000);

  beforeEach(async () => {
    await testFixtures.cleanDatabase();
    await testFixtures.purgeQueue(QUEUE_NAME);
    await testFixtures.flushRedis();
  });

  describe('POST /api/v1/commandes', () => {
    describe('Création de commande réussie', () => {
      it('devrait créer une commande avec toutes les persistances', async () => {
        const requestData = {
          clientId: 123,
          date: '2024-01-15T10:00:00.000Z',
        };

        const response = await request(app).post('/api/v1/commandes').send(requestData).expect(201);

        expect(response.body).toHaveProperty('id');
        const commandeId = response.body.id;

        // Vérification MySQL - orders
        const order = await testFixtures.findOrderById(commandeId);
        expect(order).not.toBeNull();
        expect(order.client_id).toBe(123);
        expect(order.status).toBe('RECEIVED');

        // Vérification MySQL - order_history
        const history = await testFixtures.findOrderHistory(commandeId);
        expect(history.length).toBe(1);
        expect(history[0].status).toBe('RECEIVED');

        // Vérification Redis
        const redisStatus = await testFixtures.getRedisValue(`commande:${commandeId}:status`);
        expect(redisStatus).toBe('RECEIVED');

        // Vérification RabbitMQ
        const message = await testFixtures.consumeMessage(QUEUE_NAME);
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

        const response = await request(app).post('/api/v1/commandes').send(requestData).expect(400);

        expect(response.body.message).toBe("Aucun clientId n'est fourni");

        // Vérification MySQL - aucune donnée
        const orders = await testFixtures.findAllOrders();
        expect(orders.length).toBe(0);

        // Vérification RabbitMQ - aucun message
        const message = await testFixtures.consumeMessage(QUEUE_NAME);
        expect(message).toBeNull();
      });

      it('devrait retourner 400 si clientId est invalide - aucune persistance', async () => {
        const requestData = {
          clientId: 0,
          date: '2024-01-15T10:00:00.000Z',
        };

        const response = await request(app).post('/api/v1/commandes').send(requestData).expect(400);

        expect(response.body.message).toBe('Le clientId fourni est invalide');

        const orders = await testFixtures.findAllOrders();
        expect(orders.length).toBe(0);

        const message = await testFixtures.consumeMessage(QUEUE_NAME);
        expect(message).toBeNull();
      });

      it('devrait retourner 400 si date est manquante - aucune persistance', async () => {
        const requestData = {
          clientId: 123,
        };

        const response = await request(app).post('/api/v1/commandes').send(requestData).expect(400);

        expect(response.body.message).toBe("Aucune date n'est fournie");

        const orders = await testFixtures.findAllOrders();
        expect(orders.length).toBe(0);

        const message = await testFixtures.consumeMessage(QUEUE_NAME);
        expect(message).toBeNull();
      });

      it('devrait retourner 400 si date est invalide - aucune persistance', async () => {
        const requestData = {
          clientId: 123,
          date: 'not-a-date',
        };

        const response = await request(app).post('/api/v1/commandes').send(requestData).expect(400);

        expect(response.body.message).toBe('La date fournie invalide');

        const orders = await testFixtures.findAllOrders();
        expect(orders.length).toBe(0);

        const message = await testFixtures.consumeMessage(QUEUE_NAME);
        expect(message).toBeNull();
      });

      it('devrait retourner 400 si date est dans le futur - aucune persistance', async () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString();
        const requestData = {
          clientId: 123,
          date: futureDate,
        };

        const response = await request(app).post('/api/v1/commandes').send(requestData).expect(400);

        expect(response.body.message).toBe('La date de création est dans le futur');

        const orders = await testFixtures.findAllOrders();
        expect(orders.length).toBe(0);

        const message = await testFixtures.consumeMessage(QUEUE_NAME);
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

      await testFixtures.consumeMessage(QUEUE_NAME);
      return response.body.id;
    };

    describe('Mise à jour réussie', () => {
      it('devrait mettre à jour le statut avec toutes les persistances', async () => {
        const commandeId = await createTestCommande();

        await request(app)
          .patch(`/api/v1/commandes/${commandeId}/status`)
          .send({ status: 'PAID' })
          .expect(204);

        // Vérification MySQL - orders
        const order = await testFixtures.findOrderById(commandeId);
        expect(order.status).toBe('PAID');

        // Vérification MySQL - order_history (2 entrées : RECEIVED + PAID)
        const history = await testFixtures.findOrderHistory(commandeId);
        expect(history.length).toBe(2);
        expect(history[0].status).toBe('RECEIVED');
        expect(history[1].status).toBe('PAID');

        // Vérification Redis
        const redisStatus = await testFixtures.getRedisValue(`commande:${commandeId}:status`);
        expect(redisStatus).toBe('PAID');

        // Vérification RabbitMQ
        const message = await testFixtures.consumeMessage(QUEUE_NAME);
        expect(message).not.toBeNull();
        expect(message.commandeId).toBe(commandeId);
        expect(message.status).toBe('PAID');
      });

      it('devrait permettre plusieurs mises à jour successives', async () => {
        const commandeId = await createTestCommande();

        await request(app)
          .patch(`/api/v1/commandes/${commandeId}/status`)
          .send({ status: 'PAID' })
          .expect(204);
        await testFixtures.consumeMessage(QUEUE_NAME);

        await request(app)
          .patch(`/api/v1/commandes/${commandeId}/status`)
          .send({ status: 'PREPARING' })
          .expect(204);
        await testFixtures.consumeMessage(QUEUE_NAME);

        await request(app)
          .patch(`/api/v1/commandes/${commandeId}/status`)
          .send({ status: 'SENT' })
          .expect(204);

        const history = await testFixtures.findOrderHistory(commandeId);
        expect(history.length).toBe(4);
        expect(history.map((h: any) => h.status)).toEqual(['RECEIVED', 'PAID', 'PREPARING', 'SENT']);
      });

      it('devrait retourner 400 si le workflow de statut est invalide', async () => {
        const commandeId = await createTestCommande();

        await request(app)
          .patch(`/api/v1/commandes/${commandeId}/status`)
          .send({ status: 'PAID' })
          .expect(204);
        await testFixtures.consumeMessage(QUEUE_NAME);

        const response = await request(app)
          .patch(`/api/v1/commandes/${commandeId}/status`)
          .send({ status: 'RECEIVED' })
          .expect(400);

        expect(response.body.message).toBe('Le status voulu pour la commande est invalide');
      });
    });

    describe('Validation des erreurs', () => {
      it("devrait retourner 404 si la commande n'existe pas", async () => {
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

      it("devrait retourner 400 si l'id est invalide", async () => {
        const response = await request(app)
          .patch('/api/v1/commandes/invalid/status')
          .send({ status: 'PAID' })
          .expect(400);

        expect(response.body.message).toBe("L'identifiant de commande est invalide");
      });
    });
  });
});
