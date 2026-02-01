import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import { RabbitMQContainer, StartedRabbitMQContainer } from '@testcontainers/rabbitmq';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { readFileSync } from 'fs';
import { join } from 'path';
import mysql from 'mysql2/promise';
import amqplib from 'amqplib';
import { createClient, RedisClientType } from 'redis';
import { createLogger } from '@/config/logger';

let pool: mysql.Pool | null = null;
let rabbitmqConnection: amqplib.ChannelModel | null = null;
let rabbitmqChannel: amqplib.Channel | null = null;
let redisClient: RedisClientType | null = null;

let startedContainers: {
  mysqlContainer?: StartedMySqlContainer;
  rabbitmqContainer?: StartedRabbitMQContainer;
  redisContainer?: StartedRedisContainer;
} = {};

const logger = createLogger('TestContainers');

/**
 * Démarre le conteneur MySQL et initialise le pool de connexions
 */
const startMySqlContainer = async (): Promise<void> => {
  if (startedContainers.mysqlContainer) return;

  logger.info('Démarrage du conteneur MySQL...');

  startedContainers.mysqlContainer = await new MySqlContainer('mysql:8.0')
    .withDatabase('tech_test')
    .withUsername('test_user')
    .withUserPassword('test_password')
    .withExposedPorts(3306)
    .withReuse()
    .start();

  pool = mysql.createPool({
    host: startedContainers.mysqlContainer.getHost(),
    port: startedContainers.mysqlContainer.getPort(),
    database: startedContainers.mysqlContainer.getDatabase(),
    user: startedContainers.mysqlContainer.getUsername(),
    password: startedContainers.mysqlContainer.getUserPassword(),
    waitForConnections: true,
    connectionLimit: 10,
    multipleStatements: true,
  });

  // Initialiser le schéma
  const ddlPath = join(__dirname, '../../../../sql/ddl.sql');
  const ddl = readFileSync(ddlPath, 'utf-8');
  const connection = await pool.getConnection();
  try {
    await connection.query(ddl);
  } finally {
    connection.release();
  }

  logger.info('Conteneur MySQL prêt');
};

/**
 * Démarre le conteneur RabbitMQ et initialise la connexion
 */
const startRabbitMQContainer = async (): Promise<void> => {
  if (startedContainers.rabbitmqContainer) return;

  logger.info('Démarrage du conteneur RabbitMQ...');

  startedContainers.rabbitmqContainer = await new RabbitMQContainer('rabbitmq:3.12-management')
    .withExposedPorts(5672, 15672)
    .withReuse()
    .start();

  rabbitmqConnection = await amqplib.connect(startedContainers.rabbitmqContainer.getAmqpUrl());
  rabbitmqChannel = await rabbitmqConnection.createChannel();

  logger.info('Conteneur RabbitMQ prêt');
};

/**
 * Démarre le conteneur Redis et initialise le client
 */
const startRedisContainer = async (): Promise<void> => {
  if (startedContainers.redisContainer) return;

  logger.info('Démarrage du conteneur Redis...');

  startedContainers.redisContainer = await new RedisContainer('redis:7')
    .withExposedPorts(6379)
    .withReuse()
    .start();

  redisClient = createClient({ url: startedContainers.redisContainer.getConnectionUrl() });
  await redisClient.connect();

  logger.info('Conteneur Redis prêt');
};

// ============================================================================
// API publique
// ============================================================================

/**
 * Démarre tous les conteneurs en parallèle
 * Les conteneurs sont réutilisés entre les exécutions grâce à withReuse()
 */
export const startAllContainers = async (): Promise<void> => {
  logger.info('Démarrage des conteneurs...');
  await Promise.all([startMySqlContainer(), startRabbitMQContainer(), startRedisContainer()]);
  logger.info('Conteneurs prêts');
};

/**
 * Ferme les clients et libère les ressources
 * Les conteneurs Docker restent actifs grâce à withReuse()
 */
export const stopAllContainers = async (): Promise<void> => {
  logger.info('Arrêt des clients...');

  if (pool) {
    await pool.end();
    pool = null;
  }

  if (rabbitmqChannel) {
    await rabbitmqChannel.close();
    rabbitmqChannel = null;
  }

  if (rabbitmqConnection) {
    await rabbitmqConnection.close();
    rabbitmqConnection = null;
  }

  if (redisClient?.isOpen) {
    await redisClient.quit();
    redisClient = null;
  }

  logger.info('Conteneurs arrêtés');
};

// ============================================================================
// Accesseurs
// ============================================================================

export const getTestPool = (): mysql.Pool => {
  if (!pool) throw new Error('Pool MySQL non initialisé');
  return pool;
};

export const getTestRabbitMQChannel = (): amqplib.Channel => {
  if (!rabbitmqChannel) throw new Error('Channel RabbitMQ non initialisé');
  return rabbitmqChannel;
};

export const getTestRedisClient = (): RedisClientType => {
  if (!redisClient) throw new Error('Client Redis non initialisé');
  return redisClient;
};

// ============================================================================
// Utilitaires de test
// ============================================================================

export const cleanDatabase = async (): Promise<void> => {
  if (!pool) throw new Error('Pool MySQL non initialisé');

  const connection = await pool.getConnection();
  try {
    await connection.query(`
      SET FOREIGN_KEY_CHECKS = 0;
      TRUNCATE TABLE order_history;
      TRUNCATE TABLE orders;
      SET FOREIGN_KEY_CHECKS = 1;
    `);
  } finally {
    connection.release();
  }
};

export const consumeMessage = async (queueName: string): Promise<any | null> => {
  if (!rabbitmqChannel) throw new Error('Channel RabbitMQ non initialisé');

  await rabbitmqChannel.assertQueue(queueName, { durable: true });
  const message = await rabbitmqChannel.get(queueName, { noAck: true });

  return message ? JSON.parse(message.content.toString()) : null;
};

export const purgeQueue = async (queueName: string): Promise<void> => {
  if (!rabbitmqChannel) return;

  try {
    await rabbitmqChannel.assertQueue(queueName, { durable: true });
    await rabbitmqChannel.purgeQueue(queueName);
  } catch {
    // Queue inexistante, ignoré
  }
};

export const getRedisValue = async (key: string): Promise<string | null> => {
  if (!redisClient) throw new Error('Client Redis non initialisé');
  return redisClient.get(key);
};

export const flushRedis = async (): Promise<void> => {
  if (!redisClient) throw new Error('Client Redis non initialisé');
  await redisClient.flushAll();
};
