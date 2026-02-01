import { testInfrastructure } from './infrastructure';

jest.mock('@/config/database', () => ({
  get pool() {
    return testInfrastructure.getPool();
  },
}));

jest.mock('@/config/rabbitmq', () => ({
  ...jest.requireActual('@/config/rabbitmq'),
  getRabbitMQChannel: jest.fn(async () => testInfrastructure.getRabbitMQChannel()),
}));

jest.mock('@/config/redis', () => ({
  ...jest.requireActual('@/config/redis'),
  getRedisClient: jest.fn(async () => testInfrastructure.getRedisClient()),
}));
