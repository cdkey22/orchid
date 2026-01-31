import mysql from 'mysql2/promise';
import logger from '@/config/logger';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  database: process.env.DB_NAME || 'tech_test',
  user: process.env.DB_USER || 'app_user',
  password: process.env.DB_PASSWORD || 'app_password',
  waitForConnections: true,
  connectionLimit: 10,
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
