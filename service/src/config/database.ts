import mysql from 'mysql2/promise';
import { createLogger } from '@/config/logger';

const logger = createLogger('MySQL');

const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
  queueLimit: 0,
};

logger.info('Configuration pool MySQL', {
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  user: dbConfig.user,
  connectionLimit: dbConfig.connectionLimit,
});

export const pool = mysql.createPool(dbConfig);
