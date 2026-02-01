import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import { RabbitMQContainer, StartedRabbitMQContainer } from '@testcontainers/rabbitmq';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { readFileSync } from 'fs';
import { join } from 'path';
import mysql from 'mysql2/promise';
import amqplib from 'amqplib';
import { createClient, RedisClientType } from 'redis';
import { createLogger } from '@/config/logger';

let mysqlContainer: StartedMySqlContainer | null = null;
let rabbitmqContainer: StartedRabbitMQContainer | null = null;
let redisContainer: StartedRedisContainer | null = null;
let pool: mysql.Pool | null = null;
let rabbitmqConnection: amqplib.ChannelModel | null = null;
let rabbitmqChannel: amqplib.Channel | null = null;
let redisClient: RedisClientType | null = null;

const logger = createLogger("Test container")

/**
 * Démarre un conteneur MySQL pour les tests
 */
export const startMySqlContainer = async (): Promise<StartedMySqlContainer> => {
  if (mysqlContainer) {
    return mysqlContainer;
  }

  logger.info('🚀 Démarrage du conteneur MySQL pour les tests...');

  mysqlContainer = await new MySqlContainer('mysql:8.0')
    .withDatabase('tech_test')
    .withUsername('test_user')
    .withUserPassword('test_password')
    .withExposedPorts(3306)
    .withReuse()
    .start();

  logger.info('✅ Conteneur MySQL démarré');

  // Créer le pool de connexions
  pool = mysql.createPool({
    host: mysqlContainer.getHost(),
    port: mysqlContainer.getPort(),
    database: mysqlContainer.getDatabase(),
    user: mysqlContainer.getUsername(),
    password: mysqlContainer.getUserPassword(),
    waitForConnections: true,
    connectionLimit: 10,
    multipleStatements: true, // Permet d'exécuter plusieurs statements SQL en une fois
  });

  // Exécuter le script DDL
  await initializeDatabase();

  return mysqlContainer;
};

/**
 * Démarre un conteneur RabbitMQ pour les tests
 */
export const startRabbitMQContainer = async (): Promise<StartedRabbitMQContainer> => {
  if (rabbitmqContainer) {
    return rabbitmqContainer;
  }

  logger.info('🚀 Démarrage du conteneur RabbitMQ pour les tests...');

  rabbitmqContainer = await new RabbitMQContainer('rabbitmq:3.12-management')
    .withExposedPorts(5672, 15672)
    .withReuse()
    .start();

  logger.info('✅ Conteneur RabbitMQ démarré');

  // Créer la connexion et le channel
  const amqpUrl = rabbitmqContainer.getAmqpUrl();
  rabbitmqConnection = await amqplib.connect(amqpUrl);
  rabbitmqChannel = await rabbitmqConnection.createChannel();

  return rabbitmqContainer;
};

/**
 * Démarre un conteneur Redis pour les tests
 */
export const startRedisContainer = async (): Promise<StartedRedisContainer> => {
  if (redisContainer) {
    return redisContainer;
  }

  logger.info('🚀 Démarrage du conteneur Redis pour les tests...');

  redisContainer = await new RedisContainer('redis:7')
    .withExposedPorts(6379)
    .withReuse()
    .start();

  logger.info('✅ Conteneur Redis démarré');

  // Créer le client Redis
  const redisUrl = redisContainer.getConnectionUrl();
  redisClient = createClient({ url: redisUrl });
  await redisClient.connect();

  return redisContainer;
};

/**
 * Initialise la base de données avec le script DDL
 */
export const initializeDatabase = async (): Promise<void> => {
  if (!pool) {
    throw new Error('Le pool de connexions n\'est pas initialisé');
  }

  const ddlPath = join(__dirname, '../../../../sql/ddl.sql');
  const ddl = readFileSync(ddlPath, 'utf-8');

  const connection = await pool.getConnection();

  try {
    // Exécuter tout le DDL en une seule fois (grâce à multipleStatements: true)
    await connection.query(ddl);

    logger.info('✅ Base de données initialisée avec le DDL');
  } finally {
    connection.release();
  }
};

/**
 * Nettoie les tables pour les remettre à zéro
 */
export const cleanDatabase = async (): Promise<void> => {
  if (!pool) {
    throw new Error('Le pool de connexions n\'est pas initialisé');
  }

  const connection = await pool.getConnection();

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('TRUNCATE TABLE order_history');
    await connection.query('TRUNCATE TABLE orders');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    connection.release();
  }
};

/**
 * Retourne le pool de connexions pour les tests
 */
export const getTestPool = (): mysql.Pool => {
  if (!pool) {
    throw new Error('Le pool de connexions n\'est pas initialisé. Appelez startMySqlContainer() d\'abord.');
  }
  return pool;
};

/**
 * Arrête le conteneur MySQL
 */
export const stopMySqlContainer = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
  }

  if (mysqlContainer) {
    logger.info('🛑 Arrêt du conteneur MySQL...');
    await mysqlContainer.stop();
    mysqlContainer = null;
    logger.info('✅ Conteneur MySQL arrêté');
  }
};

/**
 * Arrête le conteneur RabbitMQ
 */
export const stopRabbitMQContainer = async (): Promise<void> => {
  if (rabbitmqChannel) {
    await rabbitmqChannel.close();
    rabbitmqChannel = null;
  }

  if (rabbitmqConnection) {
    await rabbitmqConnection.close();
    rabbitmqConnection = null;
  }

  if (rabbitmqContainer) {
    logger.info('🛑 Arrêt du conteneur RabbitMQ...');
    await rabbitmqContainer.stop();
    rabbitmqContainer = null;
    logger.info('✅ Conteneur RabbitMQ arrêté');
  }
};

/**
 * Arrête le conteneur Redis
 */
export const stopRedisContainer = async (): Promise<void> => {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    redisClient = null;
  }

  if (redisContainer) {
    logger.info('🛑 Arrêt du conteneur Redis...');
    await redisContainer.stop();
    redisContainer = null;
    logger.info('✅ Conteneur Redis arrêté');
  }
};

/**
 * Récupère les informations de connexion MySQL
 */
export const getConnectionConfig = () => {
  if (!mysqlContainer) {
    throw new Error('Le conteneur MySQL n\'est pas démarré');
  }

  return {
    host: mysqlContainer.getHost(),
    port: mysqlContainer.getPort(),
    database: mysqlContainer.getDatabase(),
    user: mysqlContainer.getUsername(),
    password: mysqlContainer.getUserPassword(),
  };
};

/**
 * Récupère l'URL RabbitMQ pour les tests
 */
export const getRabbitMQUrl = (): string => {
  if (!rabbitmqContainer) {
    throw new Error('Le conteneur RabbitMQ n\'est pas démarré');
  }
  return rabbitmqContainer.getAmqpUrl();
};

/**
 * Récupère le channel RabbitMQ pour les tests
 */
export const getTestRabbitMQChannel = (): amqplib.Channel => {
  if (!rabbitmqChannel) {
    throw new Error('Le channel RabbitMQ n\'est pas initialisé');
  }
  return rabbitmqChannel;
};

/**
 * Consomme un message de la queue (pour les tests)
 */
export const consumeMessage = async (queueName: string): Promise<any | null> => {
  if (!rabbitmqChannel) {
    throw new Error('Le channel RabbitMQ n\'est pas initialisé');
  }

  await rabbitmqChannel.assertQueue(queueName, { durable: true });
  const message = await rabbitmqChannel.get(queueName, { noAck: true });

  if (message) {
    return JSON.parse(message.content.toString());
  }
  return null;
};

/**
 * Vide une queue RabbitMQ
 */
export const purgeQueue = async (queueName: string): Promise<void> => {
  if (!rabbitmqChannel) {
    throw new Error('Le channel RabbitMQ n\'est pas initialisé');
  }

  try {
    await rabbitmqChannel.assertQueue(queueName, { durable: true });
    await rabbitmqChannel.purgeQueue(queueName);
  } catch {
    // La queue n'existe peut-être pas encore, ce n'est pas grave
  }
};

/**
 * Récupère l'URL Redis pour les tests
 */
export const getRedisUrl = (): string => {
  if (!redisContainer) {
    throw new Error('Le conteneur Redis n\'est pas démarré');
  }
  return redisContainer.getConnectionUrl();
};

/**
 * Récupère le client Redis pour les tests
 */
export const getTestRedisClient = (): RedisClientType => {
  if (!redisClient) {
    throw new Error('Le client Redis n\'est pas initialisé');
  }
  return redisClient;
};

/**
 * Récupère une valeur Redis
 */
export const getRedisValue = async (key: string): Promise<string | null> => {
  if (!redisClient) {
    throw new Error('Le client Redis n\'est pas initialisé');
  }
  return await redisClient.get(key);
};

/**
 * Vide toutes les clés Redis
 */
export const flushRedis = async (): Promise<void> => {
  if (!redisClient) {
    throw new Error('Le client Redis n\'est pas initialisé');
  }
  await redisClient.flushAll();
};

/**
 * Démarre tous les conteneurs en parallèle pour optimiser le temps de démarrage
 */
export const startAllContainers = async (): Promise<void> => {
  logger.info('🚀 Démarrage de tous les conteneurs en parallèle...');

  await Promise.all([
    startMySqlContainer(),
    startRabbitMQContainer(),
    startRedisContainer(),
  ]);

  logger.info('✅ Tous les conteneurs sont prêts');
};

/**
 * Arrête tous les conteneurs
 * Si TESTCONTAINERS_KEEP_ALIVE=true, les conteneurs ne sont pas arrêtés (utile en dev)
 */
export const stopAllContainers = async (): Promise<void> => {
  const keepAlive = process.env.TESTCONTAINERS_KEEP_ALIVE === 'true';

  if (keepAlive) {
    logger.info('⏸️ TESTCONTAINERS_KEEP_ALIVE=true : les conteneurs restent actifs');
    return;
  }

  logger.info('🛑 Arrêt de tous les conteneurs...');

  await Promise.all([
    stopMySqlContainer(),
    stopRabbitMQContainer(),
    stopRedisContainer(),
  ]);

  logger.info('✅ Tous les conteneurs sont arrêtés');
};
