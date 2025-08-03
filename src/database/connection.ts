import { DataSource } from 'typeorm';
import { config } from '@/config';
import { logger } from '@/utils/logger';

// Import entities
import { User } from '@/entities/User';
import { Parking } from '@/entities/Parking';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.name,
  synchronize: config.nodeEnv === 'development', // Auto-sync schema in development
  logging: config.nodeEnv === 'development',
  entities: [User, Parking],
  migrations: ['src/database/migrations/*.ts'],
  subscribers: ['src/database/subscribers/*.ts'],
  ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
});

export const connectDatabase = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    logger.info('✅ PostgreSQL connected successfully');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await AppDataSource.destroy();
      logger.info('PostgreSQL connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to connect to PostgreSQL:', error);
    process.exit(1);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await AppDataSource.destroy();
    logger.info('PostgreSQL connection closed');
  } catch (error) {
    logger.error('Error closing PostgreSQL connection:', error);
  }
}; 