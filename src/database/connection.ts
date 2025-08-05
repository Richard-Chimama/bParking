import { DataSource } from 'typeorm';
import { config } from '../config';
import { logger } from '../utils/logger';
import { cacheService } from '../services/cache';
import { memoryMonitor } from '../utils/memoryMonitor';

// Import entities
import { User } from '../entities/User';
import { Parking } from '../entities/Parking';
import { Booking } from '../entities/Booking';
import { Payment } from '../entities/Payment';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.name,
  synchronize: config.nodeEnv === 'development', // Auto-sync schema in development
  logging: config.nodeEnv === 'development',
  entities: [User, Parking, Booking, Payment],
  migrations: ['src/database/migrations/*.ts'],
  subscribers: ['src/database/subscribers/*.ts'],
  ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
});

// Flag to track if shutdown handler is registered
let shutdownHandlerRegistered = false;

// Graceful shutdown handler
const setupGracefulShutdown = () => {
  if (shutdownHandlerRegistered) {
    return; // Already registered
  }

  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    try {
      // Stop memory monitoring
      memoryMonitor.stopMonitoring();
      
      // Disconnect from services
      await cacheService.disconnect();
      await AppDataSource.destroy();
      
      logger.info('Database connections closed through app termination');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  });

  shutdownHandlerRegistered = true;
};

export const connectDatabase = async (): Promise<void> => {
  try {
    // Initialize PostgreSQL
    await AppDataSource.initialize();
    logger.info('✅ PostgreSQL connected successfully');

    // Initialize Redis
    await cacheService.connect();
    logger.info('✅ Redis connected successfully');

    // Setup graceful shutdown (only once)
    setupGracefulShutdown();

  } catch (error) {
    logger.error('Failed to connect to databases:', error);
    process.exit(1);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await cacheService.disconnect();
    await AppDataSource.destroy();
    logger.info('Database connections closed');
  } catch (error) {
    logger.error('Error closing database connections:', error);
  }
};