import { createClient, RedisClientType } from 'redis';
import { config } from '@/config';
import { logger } from '@/utils/logger';

export class CacheService {
  private static instance: CacheService;
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;

  private constructor() {
    // Redis client will be created when connect() is called
  }

  private createClient(): RedisClientType {
    // Validate Redis URL
    const redisUrl = config.redis.url;
    if (!redisUrl || !redisUrl.startsWith('redis://')) {
      logger.warn('Invalid or missing Redis URL, using default: redis://localhost:6379');
    }

    // Check if URL already contains credentials
    const urlContainsCredentials = redisUrl && redisUrl.includes('@');
    
    const client = createClient({
      url: redisUrl || 'redis://localhost:6379',
      ...(urlContainsCredentials ? {} : { password: config.redis.password }),
    }) as RedisClientType;

    client.on('error', (err) => {
      logger.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    client.on('connect', () => {
      logger.info('✅ Redis connected successfully');
      this.isConnected = true;
    });

    client.on('disconnect', () => {
      logger.warn('Redis disconnected');
      this.isConnected = false;
    });

    return client;
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  public async connect(): Promise<void> {
    try {
      // Check if already connected to prevent duplicate connections
      if (this.client && this.isConnected) {
        logger.debug('Redis already connected, skipping connection attempt');
        return;
      }

      // Clean up existing client if it exists but is not connected
      if (this.client && !this.isConnected) {
        try {
          await this.client.disconnect();
        } catch (disconnectError) {
          logger.debug('Error disconnecting existing client:', disconnectError);
        }
        this.client = null;
      }

      if (!this.client) {
        this.client = this.createClient();
      }
      
      if (!this.isConnected) {
        await this.client.connect();
        this.isConnected = true;
        logger.info('✅ Redis cache service connected');
      }
    } catch (error) {
      logger.error('❌ Failed to connect to Redis:', error);
      logger.warn('⚠️  Application will continue without Redis caching');
      this.isConnected = false;
      // Clean up failed client
      if (this.client) {
        try {
          await this.client.disconnect();
        } catch (cleanupError) {
          logger.debug('Error cleaning up failed client:', cleanupError);
        }
        this.client = null;
      }
      // Don't throw error to allow app to continue without Redis
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.client && this.isConnected) {
        await this.client.disconnect();
        this.isConnected = false;
      }
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
    }
  }

  // Generic cache methods
  public async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.client || !this.isConnected) {
        return null;
      }

      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  public async set(key: string, value: any, ttlSeconds: number = 300): Promise<boolean> {
    try {
      if (!this.client || !this.isConnected) {
        logger.warn('Redis not connected, skipping cache set');
        return false;
      }

      await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  public async del(key: string): Promise<boolean> {
    try {
      if (!this.client || !this.isConnected) {
        logger.warn('Redis not connected, skipping cache delete');
        return false;
      }

      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  public async delPattern(pattern: string): Promise<boolean> {
    try {
      if (!this.client || !this.isConnected) {
        logger.warn('Redis not connected, skipping cache pattern delete');
        return false;
      }

      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      logger.error(`Cache pattern delete error for pattern ${pattern}:`, error);
      return false;
    }
  }

  // Parking-specific cache methods
  public async getParkings(): Promise<any[] | null> {
    return this.get<any[]>('parkings:all');
  }

  public async setParkings(parkings: any[], ttl: number = 300): Promise<boolean> {
    return this.set('parkings:all', parkings, ttl);
  }

  public async getParking(id: string): Promise<any | null> {
    return this.get<any>(`parking:${id}`);
  }

  public async setParking(id: string, parking: any, ttl: number = 600): Promise<boolean> {
    return this.set(`parking:${id}`, parking, ttl);
  }

  public async getNearbyParkings(lat: number, lng: number, maxDistance: number): Promise<any[] | null> {
    const key = `parkings:nearby:${lat}:${lng}:${maxDistance}`;
    return this.get<any[]>(key);
  }

  public async setNearbyParkings(
    lat: number,
    lng: number,
    maxDistance: number,
    parkings: any[],
    ttl: number = 180
  ): Promise<boolean> {
    const key = `parkings:nearby:${lat}:${lng}:${maxDistance}`;
    return this.set(key, parkings, ttl);
  }

  public async getParkingsByCity(city: string): Promise<any[] | null> {
    const key = `parkings:city:${city.toLowerCase()}`;
    return this.get<any[]>(key);
  }

  public async setParkingsByCity(city: string, parkings: any[], ttl: number = 600): Promise<boolean> {
    const key = `parkings:city:${city.toLowerCase()}`;
    return this.set(key, parkings, ttl);
  }

  // User-specific cache methods
  public async getUser(id: string): Promise<any | null> {
    return this.get<any>(`user:${id}`);
  }

  public async setUser(id: string, user: any, ttl: number = 1800): Promise<boolean> {
    return this.set(`user:${id}`, user, ttl);
  }

  public async getUserByEmail(email: string): Promise<any | null> {
    return this.get<any>(`user:email:${email}`);
  }

  public async setUserByEmail(email: string, user: any, ttl: number = 1800): Promise<boolean> {
    return this.set(`user:email:${email}`, user, ttl);
  }

  // Cache invalidation methods
  public async invalidateParkingCache(parkingId?: string): Promise<void> {
    try {
      // Clear all parking-related caches
      await this.delPattern('parkings:*');
      
      if (parkingId) {
        await this.del(`parking:${parkingId}`);
      }
      
      logger.info('Parking cache invalidated');
    } catch (error) {
      logger.error('Error invalidating parking cache:', error);
    }
  }

  public async invalidateUserCache(userId?: string): Promise<void> {
    try {
      if (userId) {
        await this.del(`user:${userId}`);
        // Also clear email-based cache if we have the user data
        const userData = await this.get(`user:${userId}`);
        if (userData && (userData as any).email) {
          await this.del(`user:email:${(userData as any).email}`);
        }
      } else {
        await this.delPattern('user:*');
      }
      
      logger.info('User cache invalidated');
    } catch (error) {
      logger.error('Error invalidating user cache:', error);
    }
  }

  // Health check
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.client || !this.isConnected) return false;
      
      await this.client.ping();
      return true;
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const cacheService = CacheService.getInstance();