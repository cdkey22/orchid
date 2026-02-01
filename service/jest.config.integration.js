module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/integration'],
  testMatch: ['**/*.integration.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/integration/support/jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/tests/unit/'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/api.ts'],
  coverageDirectory: 'coverage-integration',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 60000, // 1 minutes pour le démarrage des conteneurs
  maxWorkers: 1, // Exécuter les tests en série pour éviter les conflits de conteneurs
  silent: false, // Afficher les logs (console.log, winston, etc.)
};
