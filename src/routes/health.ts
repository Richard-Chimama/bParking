import { Router, Request, Response } from 'express';
import { AppDataSource } from '@/database/connection';
import { cacheService } from '@/services/cache';
import { logger } from '@/utils/logger';
import { memoryMonitor } from '@/utils/memoryMonitor';

const router = Router();

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  services: {
    database: {
      status: 'connected' | 'disconnected';
      responseTime?: number;
    };
    cache: {
      status: 'connected' | 'disconnected';
      responseTime?: number;
    };
  };
  memory: {
    used: string;
    total: string;
    percentage: number;
    rss: string;
    external: string;
    arrayBuffers: string;
  };
  version: string;
}

/**
 * Basic health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const healthCheck: HealthCheckResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: {
          status: 'disconnected'
        },
        cache: {
          status: 'disconnected'
        }
      },
      memory: {
        used: '0 MB',
        total: '0 MB',
        percentage: 0,
        rss: '0 MB',
        external: '0 MB',
        arrayBuffers: '0 MB'
      },
      version: process.env.npm_package_version || '1.0.0'
    };

    // Check database connection
    const dbStart = Date.now();
    try {
      if (AppDataSource.isInitialized) {
        await AppDataSource.query('SELECT 1');
        healthCheck.services.database.status = 'connected';
        healthCheck.services.database.responseTime = Date.now() - dbStart;
      }
    } catch (error) {
      logger.error('Database health check failed:', error);
      healthCheck.services.database.status = 'disconnected';
      healthCheck.status = 'degraded';
    }

    // Check cache connection
    const cacheStart = Date.now();
    try {
      const cacheHealthy = await cacheService.healthCheck();
      healthCheck.services.cache.status = cacheHealthy ? 'connected' : 'disconnected';
      healthCheck.services.cache.responseTime = Date.now() - cacheStart;
      
      if (!cacheHealthy) {
        healthCheck.status = 'degraded';
      }
    } catch (error) {
      logger.error('Cache health check failed:', error);
      healthCheck.services.cache.status = 'disconnected';
      healthCheck.status = 'degraded';
    }

    // Memory usage
    const memUsage = process.memoryUsage();
    const totalMem = memUsage.heapTotal;
    const usedMem = memUsage.heapUsed;
    
    healthCheck.memory = {
      used: `${Math.round(usedMem / 1024 / 1024)} MB`,
      total: `${Math.round(totalMem / 1024 / 1024)} MB`,
      percentage: Math.round((usedMem / totalMem) * 100),
      rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)} MB`,
      arrayBuffers: `${Math.round(memUsage.arrayBuffers / 1024 / 1024)} MB`
    };

    // Determine overall status
    if (healthCheck.services.database.status === 'disconnected') {
      healthCheck.status = 'unhealthy';
    }

    const statusCode = healthCheck.status === 'healthy' ? 200 : 
                      healthCheck.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(healthCheck);
  } catch (error) {
    logger.error('Health check endpoint error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

/**
 * Detailed health check with cache statistics
 */
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const basicHealth = await getBasicHealthCheck();
    
    const detailedHealth = {
      ...basicHealth,
      cache: {
        status: basicHealth.services.cache.status,
        responseTime: basicHealth.services.cache.responseTime,
        statistics: await getCacheStatistics()
      },
      database: {
        status: basicHealth.services.database.status,
        responseTime: basicHealth.services.database.responseTime,
        statistics: await getDatabaseStatistics()
      }
    };

    const statusCode = detailedHealth.status === 'healthy' ? 200 : 
                      detailedHealth.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(detailedHealth);
  } catch (error) {
    logger.error('Detailed health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Detailed health check failed'
    });
  }
});

/**
 * Cache-specific health check
 */
router.get('/cache', async (req: Request, res: Response) => {
  try {
    const cacheHealthy = await cacheService.healthCheck();
    const statistics = await getCacheStatistics();

    res.json({
      status: cacheHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      cache: {
        connected: cacheHealthy,
        statistics
      }
    });
  } catch (error) {
    logger.error('Cache health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Cache health check failed'
    });
  }
});

/**
 * Database-specific health check
 */
router.get('/database', async (req: Request, res: Response): Promise<void> => {
  try {
    const dbHealthy = AppDataSource.isInitialized;
    let statistics = null;

    if (dbHealthy) {
      try {
        await AppDataSource.query('SELECT 1');
        statistics = await getDatabaseStatistics();
      } catch (error) {
        logger.error('Database query failed:', error);
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Database query failed'
        });
        return;
      }
    }

    res.json({
      status: dbHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: dbHealthy,
        statistics
      }
    });
  } catch (error) {
    logger.error('Database health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database health check failed'
    });
  }
});

// Helper functions

async function getBasicHealthCheck(): Promise<HealthCheckResponse> {
  const healthCheck: HealthCheckResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: { status: 'disconnected' },
      cache: { status: 'disconnected' }
    },
    memory: { used: '0 MB', total: '0 MB', percentage: 0, rss: '0 MB', external: '0 MB', arrayBuffers: '0 MB' },
    version: process.env.npm_package_version || '1.0.0'
  };

  // Check database
  const dbStart = Date.now();
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.query('SELECT 1');
      healthCheck.services.database.status = 'connected';
      healthCheck.services.database.responseTime = Date.now() - dbStart;
    }
  } catch (error) {
    healthCheck.services.database.status = 'disconnected';
    healthCheck.status = 'degraded';
  }

  // Check cache
  const cacheStart = Date.now();
  try {
    const cacheHealthy = await cacheService.healthCheck();
    healthCheck.services.cache.status = cacheHealthy ? 'connected' : 'disconnected';
    healthCheck.services.cache.responseTime = Date.now() - cacheStart;
    
    if (!cacheHealthy) {
      healthCheck.status = 'degraded';
    }
  } catch (error) {
    healthCheck.services.cache.status = 'disconnected';
    healthCheck.status = 'degraded';
  }

  // Memory usage
  const memUsage = process.memoryUsage();
  const usedMem = memUsage.heapUsed;
  const totalMem = memUsage.heapTotal;
  
  healthCheck.memory = {
    used: `${Math.round(usedMem / 1024 / 1024)} MB`,
    total: `${Math.round(totalMem / 1024 / 1024)} MB`,
    percentage: Math.round((usedMem / totalMem) * 100),
    // Additional memory metrics for leak detection
    rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
    external: `${Math.round(memUsage.external / 1024 / 1024)} MB`,
    arrayBuffers: `${Math.round(memUsage.arrayBuffers / 1024 / 1024)} MB`
  };
  
  // Log memory warning if usage is high
  if (healthCheck.memory.percentage > 90) {
    logger.warn(`High memory usage detected: ${healthCheck.memory.percentage}% (${healthCheck.memory.used}/${healthCheck.memory.total})`);
  }

  if (healthCheck.services.database.status === 'disconnected') {
    healthCheck.status = 'unhealthy';
  }

  return healthCheck;
}

async function getCacheStatistics() {
  try {
    // Note: These would require Redis INFO command access
    // For now, return basic statistics
    return {
      connected: await cacheService.healthCheck(),
      // Add more cache statistics here when Redis client supports it
      note: 'Detailed cache statistics require Redis INFO command access'
    };
  } catch (error) {
    logger.error('Error getting cache statistics:', error);
    return {
      error: 'Failed to get cache statistics'
    };
  }
}

async function getDatabaseStatistics() {
  try {
    if (!AppDataSource.isInitialized) {
      return { error: 'Database not connected' };
    }

    const [parkingCount] = await AppDataSource.query(
      'SELECT COUNT(*) as count FROM parkings WHERE "isActive" = true'
    );
    
    const [userCount] = await AppDataSource.query(
      'SELECT COUNT(*) as count FROM users WHERE "isActive" = true'
    );

    const [dbSize] = await AppDataSource.query(
      'SELECT pg_size_pretty(pg_database_size(current_database())) as size'
    );

    return {
      activeParkings: parseInt(parkingCount.count),
      activeUsers: parseInt(userCount.count),
      databaseSize: dbSize.size,
      connectionPool: {
        // Add connection pool statistics if available
        note: 'Connection pool statistics not implemented'
      }
    };
  } catch (error) {
    logger.error('Error getting database statistics:', error);
    return {
      error: 'Failed to get database statistics'
    };
  }
}

// Memory stats endpoint
router.get('/memory', async (req: Request, res: Response) => {
  try {
    const memoryStats = memoryMonitor.getMemoryStats();
    const snapshots = memoryMonitor.getSnapshots();
    
    res.json({
      status: 'success',
      data: {
        current: {
          heapUsed: `${Math.round(memoryStats.current.heapUsed / 1024 / 1024)} MB`,
          heapTotal: `${Math.round(memoryStats.current.heapTotal / 1024 / 1024)} MB`,
          percentage: Math.round((memoryStats.current.heapUsed / memoryStats.current.heapTotal) * 100),
          rss: `${Math.round(memoryStats.current.rss / 1024 / 1024)} MB`,
          external: `${Math.round(memoryStats.current.external / 1024 / 1024)} MB`,
          arrayBuffers: `${Math.round(memoryStats.current.arrayBuffers / 1024 / 1024)} MB`
        },
        trend: memoryStats.trend,
        averageGrowthRate: `${memoryStats.averageGrowthRate.toFixed(2)} MB/snapshot`,
        snapshotCount: snapshots.length,
        monitoring: {
           isActive: snapshots.length > 0,
           oldestSnapshot: snapshots.length > 0 && snapshots[0] ? new Date(snapshots[0].timestamp).toISOString() : null,
           latestSnapshot: snapshots.length > 0 && snapshots[snapshots.length - 1] ? new Date(snapshots[snapshots.length - 1]!.timestamp).toISOString() : null
         }
      }
    });
  } catch (error) {
    logger.error('Error getting memory stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get memory statistics'
    });
  }
});

export default router;