# Caching Strategy for bParking Application

This document outlines the comprehensive caching strategy implemented to improve application performance, reduce database load, and enhance user experience.

## Overview

The bParking application implements a multi-layered caching strategy using Redis as the primary cache store. This approach significantly reduces database queries and improves response times for frequently accessed data.

## Architecture

### Cache Layers

1. **Application-Level Caching**: Redis-based caching for database queries
2. **GraphQL Query Caching**: Automatic caching of GraphQL resolver results
3. **Database Indexing**: Optimized database indexes for faster queries

### Technology Stack

- **Redis 7**: Primary cache store
- **Custom Cache Service**: Singleton service for cache management
- **Decorators**: TypeScript decorators for easy cache implementation
- **PostgreSQL Indexes**: Database-level optimization

## Implementation

### 1. Cache Service (`src/services/cache.ts`)

A singleton service that manages all Redis operations:

```typescript
// Get cached data
const parkings = await cacheService.getParkings();

// Set cache with TTL
await cacheService.setParkings(parkings, 300); // 5 minutes

// Invalidate cache patterns
await cacheService.invalidateParkingCache();
```

### 2. Cache Decorators (`src/decorators/cache.ts`)

Decorators for automatic caching of method results:

```typescript
@CacheParkings(300) // Cache for 5 minutes
async getAllParkings() {
  // Method implementation
}

@InvalidateParkingCache // Clear cache after mutation
async createParking(data) {
  // Method implementation
}
```

## Caching Strategies by Data Type

### Parking Data

| Query Type | Cache Key Pattern | TTL | Reasoning |
|------------|-------------------|-----|----------|
| All Parkings | `parkings:all` | 5 min | Moderate frequency, acceptable staleness |
| Single Parking | `parking:{id}` | 10 min | High frequency, low change rate |
| Nearby Parkings | `parkings:nearby:{lat}:{lng}:{distance}` | 3 min | Real-time nature, location-sensitive |
| City Parkings | `parkings:city:{city}` | 10 min | Stable data, city-level aggregation |

### User Data

| Query Type | Cache Key Pattern | TTL | Reasoning |
|------------|-------------------|-----|----------|
| User Profile | `user:{id}` | 30 min | Personal data, moderate change rate |
| User by Email | `user:email:{email}` | 30 min | Authentication queries |

### Cache Invalidation

#### Automatic Invalidation
- **Parking Creation/Update**: Clears all parking-related caches
- **User Registration/Verification**: Clears user-related caches
- **Data Mutations**: Automatic cache invalidation on write operations

#### Manual Invalidation
- **Admin Operations**: Manual cache clearing for administrative changes
- **Bulk Updates**: Pattern-based cache invalidation

## Performance Benefits

### Expected Improvements

1. **Response Time Reduction**: 60-80% faster for cached queries
2. **Database Load Reduction**: 40-60% fewer database queries
3. **Scalability**: Better handling of concurrent users
4. **Cost Efficiency**: Reduced database resource consumption

### Metrics to Monitor

- Cache hit ratio (target: >80%)
- Average response time
- Database query count
- Redis memory usage
- Cache invalidation frequency

## Database Indexing Strategy

### Existing Indexes (Already Implemented)

```sql
-- Parking entity indexes
CREATE INDEX idx_parking_location ON parkings USING GIST(location);
CREATE INDEX idx_parking_owner ON parkings(ownerId);
CREATE INDEX idx_parking_active ON parkings(isActive);
CREATE INDEX idx_parking_verified ON parkings(isVerified);
CREATE INDEX idx_parking_rating ON parkings(rating);
CREATE INDEX idx_parking_created ON parkings(createdAt);

-- User entity indexes
CREATE UNIQUE INDEX idx_user_email ON users(email);
CREATE UNIQUE INDEX idx_user_phone ON users(phoneNumber);
CREATE INDEX idx_user_role ON users(role);
CREATE INDEX idx_user_verified ON users(isVerified);
CREATE INDEX idx_user_created ON users(createdAt);
```

### Recommended Additional Indexes

```sql
-- Composite indexes for common query patterns
CREATE INDEX idx_parking_active_verified ON parkings(isActive, isVerified);
CREATE INDEX idx_parking_city_active ON parkings((address->>'city'), isActive);
CREATE INDEX idx_parking_available_spaces ON parkings(availableSpaces) WHERE availableSpaces > 0;

-- Partial indexes for performance
CREATE INDEX idx_parking_active_only ON parkings(id) WHERE isActive = true;
CREATE INDEX idx_user_active_only ON users(id) WHERE isActive = true;

-- JSONB indexes for address queries
CREATE INDEX idx_parking_address_gin ON parkings USING GIN(address);
```

## Best Practices

### 1. Cache Key Design
- Use consistent naming conventions
- Include relevant parameters in keys
- Avoid overly long keys
- Use hierarchical patterns for easy invalidation

### 2. TTL Selection
- **Real-time data**: 1-5 minutes
- **Semi-static data**: 10-30 minutes
- **Static data**: 1-24 hours
- **User sessions**: 30 minutes - 2 hours

### 3. Cache Invalidation
- Invalidate on write operations
- Use pattern-based invalidation for related data
- Implement graceful degradation when cache fails

### 4. Monitoring and Alerting
- Monitor cache hit ratios
- Alert on cache service failures
- Track memory usage and eviction rates
- Monitor query performance improvements

## Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password

# Cache Control
SKIP_CACHE=false  # Set to true to disable caching in development
CACHE_DEFAULT_TTL=300  # Default TTL in seconds
```

### Docker Compose

Redis is already configured in `docker-compose.yml`:

```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
```

## Troubleshooting

### Common Issues

1. **Cache Miss Rate Too High**
   - Check TTL values
   - Verify cache key consistency
   - Monitor invalidation patterns

2. **Memory Usage Issues**
   - Implement cache size limits
   - Use appropriate eviction policies
   - Monitor key expiration

3. **Cache Inconsistency**
   - Ensure proper invalidation on writes
   - Check for race conditions
   - Implement cache warming strategies

### Health Checks

```typescript
// Check cache service health
const isHealthy = await cacheService.healthCheck();

// Monitor cache statistics
const stats = await cacheService.getStats();
```

## Future Enhancements

1. **Cache Warming**: Pre-populate cache with frequently accessed data
2. **Distributed Caching**: Multi-node Redis setup for high availability
3. **Cache Analytics**: Detailed metrics and performance analysis
4. **Smart Invalidation**: ML-based cache invalidation strategies
5. **Edge Caching**: CDN integration for static content

## Security Considerations

1. **Data Sensitivity**: Never cache sensitive user data (passwords, tokens)
2. **Access Control**: Implement proper Redis authentication
3. **Encryption**: Use Redis AUTH and TLS in production
4. **Data Isolation**: Separate cache namespaces for different environments

## Conclusion

The implemented caching strategy provides significant performance improvements while maintaining data consistency and reliability. Regular monitoring and optimization ensure the cache system continues to deliver optimal performance as the application scales.