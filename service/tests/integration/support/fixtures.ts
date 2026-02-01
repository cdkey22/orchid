import { TestInfrastructure, testInfrastructure } from './infrastructure';

export class TestFixtures {
  constructor(private readonly containers: TestInfrastructure) {}

  async cleanDatabase(): Promise<void> {
    const connection = await this.containers.getPool().getConnection();
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
  }

  async consumeMessage(queueName: string): Promise<any | null> {
    const channel = this.containers.getRabbitMQChannel();
    await channel.assertQueue(queueName, { durable: true });
    const message = await channel.get(queueName, { noAck: true });
    return message ? JSON.parse(message.content.toString()) : null;
  }

  async purgeQueue(queueName: string): Promise<void> {
    try {
      const channel = this.containers.getRabbitMQChannel();
      await channel.assertQueue(queueName, { durable: true });
      await channel.purgeQueue(queueName);
    } catch {
      // Queue inexistante, ignoré
    }
  }

  async getRedisValue(key: string): Promise<string | null> {
    return this.containers.getRedisClient().get(key);
  }

  async flushRedis(): Promise<void> {
    await this.containers.getRedisClient().flushAll();
  }

  async findOrderById(id: number): Promise<any | null> {
    const connection = await this.containers.getPool().getConnection();
    try {
      const [rows]: any[] = await connection.execute('SELECT * FROM orders WHERE id = ?', [id]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  }

  async findAllOrders(): Promise<any[]> {
    const connection = await this.containers.getPool().getConnection();
    try {
      const [rows]: any[] = await connection.execute('SELECT * FROM orders');
      return rows;
    } finally {
      connection.release();
    }
  }

  async findOrderHistory(orderId: number): Promise<any[]> {
    const connection = await this.containers.getPool().getConnection();
    try {
      const [rows]: any[] = await connection.execute(
        'SELECT * FROM order_history WHERE order_id = ? ORDER BY change_date',
        [orderId]
      );
      return rows;
    } finally {
      connection.release();
    }
  }
}

export const testFixtures = new TestFixtures(testInfrastructure);
