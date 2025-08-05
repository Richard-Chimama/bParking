import { cacheService } from '@/services/cache';
import { logger } from '@/utils/logger';
import crypto from 'crypto';

// Helper function to generate efficient cache keys
const generateCacheKey = (prefix: string, className: string, methodName: string, args: any[]): string => {
  if (args.length === 0) {
    return `${prefix}${className}:${methodName}`;
  }

  // For simple primitive arguments, use direct stringification
  if (args.length <= 3 && args.every(arg => 
    typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean'
  )) {
    return `${prefix}${className}:${methodName}:${args.join(':')}`;
  }

  // For complex objects or large argument lists, use hash
  const argsString = JSON.stringify(args);
  if (argsString.length > 200) {
    const hash = crypto.createHash('md5').update(argsString).digest('hex');
    return `${prefix}${className}:${methodName}:${hash}`;
  }

  // For moderate-sized arguments, use direct stringification
  return `${prefix}${className}:${methodName}:${argsString}`;
};

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string;
  keyGenerator?: (...args: any[]) => string;
  skipCache?: boolean;
}

/**
 * Cache decorator for methods
 * @param options Cache configuration options
 */
export function Cache(options: CacheOptions = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const {
      ttl = 300,
      keyPrefix = '',
      keyGenerator,
      skipCache = false
    } = options;

    descriptor.value = async function (...args: any[]) {
      // Skip cache if disabled or in development mode with skip flag
      if (skipCache || process.env.SKIP_CACHE === 'true') {
        return await method.apply(this, args);
      }

      // Generate cache key
      let cacheKey: string;
      if (keyGenerator) {
        cacheKey = keyGenerator(...args);
      } else {
        cacheKey = generateCacheKey(keyPrefix, target.constructor.name, propertyName, args);
      }

      try {
        // Try to get from cache first
        const cachedResult = await cacheService.get(cacheKey);
        if (cachedResult !== null) {
          logger.debug(`Cache hit for key: ${cacheKey}`);
          return cachedResult;
        }

        // Cache miss - execute original method
        logger.debug(`Cache miss for key: ${cacheKey}`);
        const result = await method.apply(this, args);

        // Store result in cache
        if (result !== null && result !== undefined) {
          await cacheService.set(cacheKey, result, ttl);
          logger.debug(`Cached result for key: ${cacheKey}`);
        }

        return result;
      } catch (error) {
        logger.error(`Cache error for key ${cacheKey}:`, error);
        // Fallback to original method if cache fails
        return await method.apply(this, args);
      }
    };

    return descriptor;
  };
}

/**
 * Cache invalidation decorator
 * @param patterns Array of cache key patterns to invalidate
 */
export function InvalidateCache(patterns: string[]) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        // Execute original method first
        const result = await method.apply(this, args);

        // Invalidate cache patterns
        for (const pattern of patterns) {
          await cacheService.delPattern(pattern);
          logger.debug(`Invalidated cache pattern: ${pattern}`);
        }

        return result;
      } catch (error) {
        logger.error(`Error in method ${propertyName}:`, error);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Specific cache decorators for common use cases
 */

// Parking-related caching
export const CacheParkings = (ttl: number = 300) => 
  Cache({
    ttl,
    keyPrefix: 'parkings:',
    keyGenerator: (...args) => {
      if (args.length === 0) return 'parkings:all';
      return `parkings:${JSON.stringify(args)}`;
    }
  });

export const CacheParking = (ttl: number = 600) => 
  Cache({
    ttl,
    keyPrefix: 'parking:',
    keyGenerator: (id: string) => `parking:${id}`
  });

export const CacheNearbyParkings = (ttl: number = 180) => 
  Cache({
    ttl,
    keyPrefix: 'parkings:nearby:',
    keyGenerator: (lat: number, lng: number, maxDistance: number) => 
      `parkings:nearby:${lat}:${lng}:${maxDistance}`
  });

export const CacheParkingsByCity = (ttl: number = 600) => 
  Cache({
    ttl,
    keyPrefix: 'parkings:city:',
    keyGenerator: (city: string) => `parkings:city:${city.toLowerCase()}`
  });

// User-related caching
export const CacheUser = (ttl: number = 1800) => 
  Cache({
    ttl,
    keyPrefix: 'user:',
    keyGenerator: (id: string) => `user:${id}`
  });

export const CacheUserByEmail = (ttl: number = 1800) => 
  Cache({
    ttl,
    keyPrefix: 'user:email:',
    keyGenerator: (email: string) => `user:email:${email}`
  });

// Cache invalidation decorators
export const InvalidateParkingCache = InvalidateCache(['parkings:*']);
export const InvalidateUserCache = InvalidateCache(['user:*']);