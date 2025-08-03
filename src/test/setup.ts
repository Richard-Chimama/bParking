import { AppDataSource } from '@/database/connection';

// Test database setup
beforeAll(async () => {
  // Connect to test database
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
});

afterAll(async () => {
  // Close database connection
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
});

afterEach(async () => {
  // Clean up database after each test
  const entities = AppDataSource.entityMetadatas;
  for (const entity of entities) {
    const repository = AppDataSource.getRepository(entity.name);
    await repository.clear();
  }
});

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log during tests
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}; 