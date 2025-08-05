-- Database Optimization Script for bParking Application
-- This script adds additional indexes to improve query performance
-- Run this script after the initial database setup

-- ============================================================================
-- COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- ============================================================================

-- Parking queries often filter by both active and verified status
CREATE INDEX IF NOT EXISTS idx_parking_active_verified 
ON parkings(isActive, isVerified);

-- City-based parking searches with active filter
CREATE INDEX IF NOT EXISTS idx_parking_city_active 
ON parkings((address->>'city'), isActive);

-- Available spaces for real-time availability queries
CREATE INDEX IF NOT EXISTS idx_parking_available_spaces 
ON parkings(availableSpaces) 
WHERE availableSpaces > 0;

-- Owner-based queries with active status
CREATE INDEX IF NOT EXISTS idx_parking_owner_active 
ON parkings(ownerId, isActive);

-- Rating-based queries for top-rated parkings
CREATE INDEX IF NOT EXISTS idx_parking_rating_active 
ON parkings(rating DESC, isActive) 
WHERE isActive = true AND rating > 0;

-- ============================================================================
-- PARTIAL INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index only active parkings (most common queries)
CREATE INDEX IF NOT EXISTS idx_parking_active_only 
ON parkings(id, createdAt) 
WHERE isActive = true;

-- Index only verified parkings
CREATE INDEX IF NOT EXISTS idx_parking_verified_only 
ON parkings(id, rating, totalSpaces) 
WHERE isVerified = true;

-- Index only active users
CREATE INDEX IF NOT EXISTS idx_user_active_only 
ON users(id, createdAt) 
WHERE isActive = true;

-- Index only verified users
CREATE INDEX IF NOT EXISTS idx_user_verified_only 
ON users(id, role, createdAt) 
WHERE isVerified = true;

-- ============================================================================
-- JSONB INDEXES FOR COMPLEX QUERIES
-- ============================================================================

-- GIN index for address JSONB queries
CREATE INDEX IF NOT EXISTS idx_parking_address_gin 
ON parkings USING GIN(address);

-- Specific JSONB path indexes for common address queries
CREATE INDEX IF NOT EXISTS idx_parking_city 
ON parkings((address->>'city'));

CREATE INDEX IF NOT EXISTS idx_parking_state 
ON parkings((address->>'state'));

CREATE INDEX IF NOT EXISTS idx_parking_zipcode 
ON parkings((address->>'zipCode'));

-- User preferences JSONB index
CREATE INDEX IF NOT EXISTS idx_user_preferences_gin 
ON users USING GIN(preferences) 
WHERE preferences IS NOT NULL;

-- User address JSONB index
CREATE INDEX IF NOT EXISTS idx_user_address_gin 
ON users USING GIN(address) 
WHERE address IS NOT NULL;

-- ============================================================================
-- SPATIAL INDEXES OPTIMIZATION
-- ============================================================================

-- Ensure spatial index exists with proper configuration
-- (This should already exist from entity definition, but ensuring it's optimal)
DROP INDEX IF EXISTS idx_parking_location_gist;
CREATE INDEX idx_parking_location_gist 
ON parkings USING GIST(location) 
WHERE location IS NOT NULL;

-- Spatial index with additional filters for common queries
CREATE INDEX IF NOT EXISTS idx_parking_location_active_gist 
ON parkings USING GIST(location) 
WHERE isActive = true AND location IS NOT NULL;

-- ============================================================================
-- TEXT SEARCH INDEXES
-- ============================================================================

-- Full-text search index for parking names and descriptions
CREATE INDEX IF NOT EXISTS idx_parking_search_gin 
ON parkings USING GIN(to_tsvector('english', name || ' ' || description));

-- Trigram indexes for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_parking_name_trgm 
ON parkings USING GIN(name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_parking_description_trgm 
ON parkings USING GIN(description gin_trgm_ops);

-- User name search indexes
CREATE INDEX IF NOT EXISTS idx_user_name_trgm 
ON users USING GIN((firstName || ' ' || lastName) gin_trgm_ops);

-- ============================================================================
-- PERFORMANCE MONITORING VIEWS
-- ============================================================================

-- Create a view to monitor index usage
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    CASE 
        WHEN idx_scan = 0 THEN 'Unused'
        WHEN idx_scan < 100 THEN 'Low Usage'
        WHEN idx_scan < 1000 THEN 'Medium Usage'
        ELSE 'High Usage'
    END as usage_level
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Create a view to monitor table statistics
CREATE OR REPLACE VIEW table_stats AS
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- ============================================================================
-- MAINTENANCE PROCEDURES
-- ============================================================================

-- Function to analyze table statistics
CREATE OR REPLACE FUNCTION analyze_tables()
RETURNS void AS $$
BEGIN
    ANALYZE parkings;
    ANALYZE users;
    RAISE NOTICE 'Table analysis completed';
END;
$$ LANGUAGE plpgsql;

-- Function to reindex all tables
CREATE OR REPLACE FUNCTION reindex_tables()
RETURNS void AS $$
BEGIN
    REINDEX TABLE parkings;
    REINDEX TABLE users;
    RAISE NOTICE 'Reindexing completed';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- QUERY OPTIMIZATION SETTINGS
-- ============================================================================

-- Optimize PostgreSQL settings for better performance
-- Note: These should be set in postgresql.conf for production

-- Enable query planning optimizations
SET enable_seqscan = on;
SET enable_indexscan = on;
SET enable_bitmapscan = on;
SET enable_hashjoin = on;
SET enable_mergejoin = on;
SET enable_nestloop = on;

-- Optimize work memory for complex queries
-- SET work_mem = '256MB';  -- Uncomment and adjust for production

-- Optimize shared buffers
-- SET shared_buffers = '256MB';  -- Uncomment and adjust for production

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Query to verify all indexes are created
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
    AND tablename IN ('parkings', 'users')
ORDER BY tablename, indexname;

-- Query to check index sizes
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

/*
-- Example queries that will benefit from these indexes:

-- 1. Find active parkings in a city
SELECT * FROM parkings 
WHERE address->>'city' = 'Lusaka' 
    AND isActive = true;

-- 2. Find nearby active parkings
SELECT * FROM parkings 
WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(-15.4067, 28.2871), 4326), 1000)
    AND isActive = true;

-- 3. Search parkings by name
SELECT * FROM parkings 
WHERE name ILIKE '%mall%' 
    AND isActive = true;

-- 4. Find top-rated parkings
SELECT * FROM parkings 
WHERE isActive = true 
    AND isVerified = true 
    AND rating >= 4.0
ORDER BY rating DESC;

-- 5. Find parkings with available spaces
SELECT * FROM parkings 
WHERE availableSpaces > 0 
    AND isActive = true;
*/

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Database optimization completed successfully!';
    RAISE NOTICE 'All indexes have been created.';
    RAISE NOTICE 'Run ANALYZE to update table statistics.';
    RAISE NOTICE '============================================';
END $$;