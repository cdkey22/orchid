import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import { readFileSync } from 'fs';
import { join } from 'path';
import mysql from 'mysql2/promise';

let container: StartedMySqlContainer | null = null;
let pool: mysql.Pool | null = null;

/**
 * Démarre un conteneur MySQL pour les tests
 */
export const startMySqlContainer = async (): Promise<StartedMySqlContainer> => {
  if (container) {
    return container;
  }

  console.log('🚀 Démarrage du conteneur MySQL pour les tests...');

  container = await new MySqlContainer('mysql:8.0')
    .withDatabase('tech_test')
    .withUsername('test_user')
    .withUserPassword('test_password')
    .withExposedPorts(3306)
    .start();

  console.log('✅ Conteneur MySQL démarré');

  // Créer le pool de connexions
  pool = mysql.createPool({
    host: container.getHost(),
    port: container.getPort(),
    database: container.getDatabase(),
    user: container.getUsername(),
    password: container.getUserPassword(),
    waitForConnections: true,
    connectionLimit: 10,
    multipleStatements: true, // Permet d'exécuter plusieurs statements SQL en une fois
  });

  // Exécuter le script DDL
  await initializeDatabase();

  return container;
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

    console.log('✅ Base de données initialisée avec le DDL');
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

  if (container) {
    console.log('🛑 Arrêt du conteneur MySQL...');
    await container.stop();
    container = null;
    console.log('✅ Conteneur MySQL arrêté');
  }
};

/**
 * Récupère les informations de connexion pour mocker le pool dans les tests
 */
export const getConnectionConfig = () => {
  if (!container) {
    throw new Error('Le conteneur n\'est pas démarré');
  }

  return {
    host: container.getHost(),
    port: container.getPort(),
    database: container.getDatabase(),
    user: container.getUsername(),
    password: container.getUserPassword(),
  };
};
