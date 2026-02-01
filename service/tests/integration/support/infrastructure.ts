import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import { RabbitMQContainer, StartedRabbitMQContainer } from '@testcontainers/rabbitmq';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { readFileSync } from 'fs';
import { join } from 'path';
import mysql from 'mysql2/promise';
import amqplib from 'amqplib';
import { createClient, RedisClientType } from 'redis';
import { createLogger } from '@/config/logger';

const logger = createLogger('TestInfrastructure');

export class TestInfrastructure {
  private containers: {
    mysql?: StartedMySqlContainer;
    rabbitmq?: StartedRabbitMQContainer;
    redis?: StartedRedisContainer;
  } = {};

  private clients: {
    pool?: mysql.Pool;
    rabbitmqConnection?: amqplib.ChannelModel;
    rabbitmqChannel?: amqplib.Channel;
    redis?: RedisClientType;
  } = {};

  async startAll(): Promise<void> {
    logger.info('Démarrage des conteneurs...');
    await Promise.all([
      this.startMySql(),
      this.startRabbitMQ(),
      this.startRedis(),
    ]);
    logger.info('Conteneurs prêts');
  }

  async closeClients(): Promise<void> {
    logger.info('Fermeture des clients...');

    if (this.clients.pool) {
      await this.clients.pool.end();
      this.clients.pool = undefined;
    }

    if (this.clients.rabbitmqChannel) {
      await this.clients.rabbitmqChannel.close();
      this.clients.rabbitmqChannel = undefined;
    }

    if (this.clients.rabbitmqConnection) {
      await this.clients.rabbitmqConnection.close();
      this.clients.rabbitmqConnection = undefined;
    }

    if (this.clients.redis?.isOpen) {
      await this.clients.redis.quit();
      this.clients.redis = undefined;
    }

    logger.info('Clients fermés');
  }

  getPool(): mysql.Pool {
    if (!this.clients.pool) throw new Error('Pool MySQL non initialisé');
    return this.clients.pool;
  }

  getRabbitMQChannel(): amqplib.Channel {
    if (!this.clients.rabbitmqChannel) throw new Error('Channel RabbitMQ non initialisé');
    return this.clients.rabbitmqChannel;
  }

  getRedisClient(): RedisClientType {
    if (!this.clients.redis) throw new Error('Client Redis non initialisé');
    return this.clients.redis;
  }

  private async startMySql(): Promise<void> {
    if (this.containers.mysql) return;

    logger.info('Démarrage du conteneur MySQL...');

    this.containers.mysql = await new MySqlContainer('mysql:8.0')
      .withDatabase('tech_test')
      .withUsername('test_user')
      .withUserPassword('test_password')
      .withExposedPorts(3306)
      .withReuse()
      .start();

    this.clients.pool = mysql.createPool({
      host: this.containers.mysql.getHost(),
      port: this.containers.mysql.getPort(),
      database: this.containers.mysql.getDatabase(),
      user: this.containers.mysql.getUsername(),
      password: this.containers.mysql.getUserPassword(),
      waitForConnections: true,
      connectionLimit: 10,
      multipleStatements: true,
    });

    const ddlPath = join(__dirname, '../../../../sql/ddl.sql');
    const ddl = readFileSync(ddlPath, 'utf-8');
    const connection = await this.clients.pool.getConnection();
    try {
      await connection.query(ddl);
    } finally {
      connection.release();
    }

    logger.info('Conteneur MySQL prêt');
  }

  private async startRabbitMQ(): Promise<void> {
    if (this.containers.rabbitmq) return;

    logger.info('Démarrage du conteneur RabbitMQ...');

    this.containers.rabbitmq = await new RabbitMQContainer('rabbitmq:3.12-management')
      .withExposedPorts(5672, 15672)
      .withReuse()
      .start();

    this.clients.rabbitmqConnection = await amqplib.connect(this.containers.rabbitmq.getAmqpUrl());
    this.clients.rabbitmqChannel = await this.clients.rabbitmqConnection.createChannel();

    logger.info('Conteneur RabbitMQ prêt');
  }

  private async startRedis(): Promise<void> {
    if (this.containers.redis) return;

    logger.info('Démarrage du conteneur Redis...');

    this.containers.redis = await new RedisContainer('redis:7')
      .withExposedPorts(6379)
      .withReuse()
      .start();

    this.clients.redis = createClient({ url: this.containers.redis.getConnectionUrl() });
    await this.clients.redis.connect();

    logger.info('Conteneur Redis prêt');
  }
}

export const testInfrastructure = new TestInfrastructure();
