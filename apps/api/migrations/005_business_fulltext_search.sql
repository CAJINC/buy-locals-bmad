-- Migration 005: Business Full-Text Search Infrastructure
-- Implements comprehensive PostgreSQL full-text search for business discovery
-- Supports weighted ranking, fuzzy matching, and performance analytics

BEGIN;

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Add full-text search columns to businesses table
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS search_vector_name tsvector,
ADD COLUMN IF NOT EXISTS search_vector_services tsvector,
ADD COLUMN IF NOT EXISTS search_vector_description tsvector,
ADD COLUMN IF NOT EXISTS search_vector_combined tsvector,
ADD COLUMN IF NOT EXISTS search_updated_at timestamp DEFAULT NOW();

-- Create search analytics table for query tracking and performance monitoring
CREATE TABLE IF NOT EXISTS business_search_analytics (
    id SERIAL PRIMARY KEY,
    search_query TEXT NOT NULL,
    query_type VARCHAR(50) NOT NULL DEFAULT 'fulltext', -- 'fulltext', 'location', 'combined', 'fuzzy'
    
    -- Query context
    search_location POINT,
    search_radius_km NUMERIC(8,2),
    user_location POINT,
    
    -- Performance metrics
    execution_time_ms NUMERIC(8,2) NOT NULL,
    results_count INTEGER NOT NULL DEFAULT 0,
    
    -- Business intelligence
    clicked_business_ids INTEGER[] DEFAULT '{}',
    conversion_business_id INTEGER REFERENCES businesses(id),
    
    -- Metadata
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexing
    CONSTRAINT valid_radius CHECK (search_radius_km > 0 AND search_radius_km <= 100),
    CONSTRAINT valid_execution_time CHECK (execution_time_ms >= 0)
);

-- Create function to update search vectors with weighted ranking
-- Weight hierarchy: name=A (highest), services=B, description=C
CREATE OR REPLACE FUNCTION update_business_search_vectors()
RETURNS TRIGGER AS $$
BEGIN
    -- Individual search vectors with language-specific processing
    NEW.search_vector_name = to_tsvector('english', COALESCE(NEW.name, ''));
    NEW.search_vector_services = to_tsvector('english', 
        COALESCE(array_to_string(NEW.services, ' '), '')
    );
    NEW.search_vector_description = to_tsvector('english', COALESCE(NEW.description, ''));
    
    -- Combined weighted search vector for comprehensive ranking
    NEW.search_vector_combined = 
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.services, ' '), '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.address, '')), 'D');
    
    -- Update search timestamp
    NEW.search_updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically maintain search vectors
DROP TRIGGER IF EXISTS businesses_search_vector_update ON businesses;
CREATE TRIGGER businesses_search_vector_update
    BEFORE INSERT OR UPDATE OF name, services, description, address
    ON businesses
    FOR EACH ROW
    EXECUTE FUNCTION update_business_search_vectors();

-- Update existing records with search vectors
UPDATE businesses SET search_updated_at = NOW() WHERE search_vector_combined IS NULL;

-- Create high-performance GIN indexes for full-text search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_search_name_gin 
ON businesses USING GIN (search_vector_name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_search_services_gin 
ON businesses USING GIN (search_vector_services);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_search_description_gin 
ON businesses USING GIN (search_vector_description);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_search_combined_gin 
ON businesses USING GIN (search_vector_combined);

-- Create composite indexes for location + text search optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_location_search_combined 
ON businesses USING GIST (location, search_vector_combined);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_location_active_search 
ON businesses (active, location) 
WHERE active = true 
INCLUDE (search_vector_combined);

-- Create trigram indexes for fuzzy text matching
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_name_trigram 
ON businesses USING GIN (name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_services_trigram 
ON businesses USING GIN ((array_to_string(services, ' ')) gin_trgm_ops);

-- Create indexes for search analytics performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_analytics_query_type_created 
ON business_search_analytics (query_type, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_analytics_location_created 
ON business_search_analytics USING GIST (search_location, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_analytics_performance 
ON business_search_analytics (execution_time_ms, results_count, created_at);

-- Create function for search performance analytics
CREATE OR REPLACE FUNCTION log_search_analytics(
    p_query TEXT,
    p_query_type VARCHAR(50),
    p_search_location POINT DEFAULT NULL,
    p_search_radius_km NUMERIC DEFAULT NULL,
    p_user_location POINT DEFAULT NULL,
    p_execution_time_ms NUMERIC DEFAULT NULL,
    p_results_count INTEGER DEFAULT 0,
    p_user_agent TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    analytics_id INTEGER;
BEGIN
    INSERT INTO business_search_analytics (
        search_query,
        query_type,
        search_location,
        search_radius_km,
        user_location,
        execution_time_ms,
        results_count,
        user_agent,
        ip_address,
        created_at
    ) VALUES (
        p_query,
        p_query_type,
        p_search_location,
        p_search_radius_km,
        p_user_location,
        COALESCE(p_execution_time_ms, 0),
        p_results_count,
        p_user_agent,
        p_ip_address,
        NOW()
    ) RETURNING id INTO analytics_id;
    
    RETURN analytics_id;
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for search performance monitoring
CREATE MATERIALIZED VIEW IF NOT EXISTS search_performance_summary AS
SELECT 
    query_type,
    DATE_TRUNC('hour', created_at) as hour_bucket,
    COUNT(*) as query_count,
    AVG(execution_time_ms) as avg_execution_time_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95_execution_time_ms,
    AVG(results_count) as avg_results_count,
    COUNT(DISTINCT search_query) as unique_queries
FROM business_search_analytics
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY query_type, DATE_TRUNC('hour', created_at)
ORDER BY hour_bucket DESC;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_search_performance_summary_type_hour 
ON search_performance_summary (query_type, hour_bucket DESC);

-- Create function to refresh search performance summary
CREATE OR REPLACE FUNCTION refresh_search_performance_summary()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY search_performance_summary;
END;
$$ LANGUAGE plpgsql;

-- Add business search ranking function with configurable weights
CREATE OR REPLACE FUNCTION calculate_business_search_rank(
    p_search_query TEXT,
    p_business_name TEXT,
    p_business_services TEXT[],
    p_business_description TEXT,
    p_business_location POINT,
    p_user_location POINT DEFAULT NULL,
    p_max_distance_km NUMERIC DEFAULT 10
) RETURNS NUMERIC AS $$
DECLARE
    text_rank NUMERIC := 0;
    distance_rank NUMERIC := 0;
    final_rank NUMERIC := 0;
    distance_km NUMERIC;
BEGIN
    -- Calculate text relevance rank using ts_rank_cd with combined weights
    SELECT ts_rank_cd(
        setweight(to_tsvector('english', COALESCE(p_business_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(p_business_services, ' '), '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(p_business_description, '')), 'C'),
        plainto_tsquery('english', p_search_query)
    ) INTO text_rank;
    
    -- Calculate distance rank if user location provided
    IF p_user_location IS NOT NULL AND p_business_location IS NOT NULL THEN
        distance_km := ST_Distance(
            ST_GeogFromText('POINT(' || ST_X(p_user_location) || ' ' || ST_Y(p_user_location) || ')'),
            ST_GeogFromText('POINT(' || ST_X(p_business_location) || ' ' || ST_Y(p_business_location) || ')')
        ) / 1000.0;
        
        -- Distance ranking: closer = higher rank
        IF distance_km <= p_max_distance_km THEN
            distance_rank := 1.0 - (distance_km / p_max_distance_km);
        ELSE
            distance_rank := 0;
        END IF;
    ELSE
        distance_rank := 0.5; -- Neutral rank when no location context
    END IF;
    
    -- Combine ranks: 70% text relevance, 30% location proximity
    final_rank := (text_rank * 0.7) + (distance_rank * 0.3);
    
    RETURN final_rank;
END;
$$ LANGUAGE plpgsql;

-- Create search configuration for business-specific language processing
CREATE TEXT SEARCH CONFIGURATION IF NOT EXISTS business_search (COPY = english);

-- Add business-specific synonyms and terms
-- ALTER TEXT SEARCH CONFIGURATION business_search 
-- ALTER MAPPING FOR asciiword, asciihword, hword_asciipart, word, hword, hword_part 
-- WITH business_synonym_dict, english_stem;

-- Grant necessary permissions
GRANT SELECT, INSERT ON business_search_analytics TO api_user;
GRANT USAGE, SELECT ON SEQUENCE business_search_analytics_id_seq TO api_user;
GRANT SELECT ON search_performance_summary TO api_user;
GRANT EXECUTE ON FUNCTION log_search_analytics TO api_user;
GRANT EXECUTE ON FUNCTION calculate_business_search_rank TO api_user;
GRANT EXECUTE ON FUNCTION refresh_search_performance_summary TO api_user;

-- Add helpful comments for documentation
COMMENT ON TABLE business_search_analytics IS 'Tracks search queries and performance metrics for business discovery optimization';
COMMENT ON COLUMN businesses.search_vector_combined IS 'Weighted full-text search vector: name=A, services=B, description=C, address=D';
COMMENT ON FUNCTION calculate_business_search_rank IS 'Calculates composite search ranking based on text relevance (70%) and location proximity (30%)';
COMMENT ON MATERIALIZED VIEW search_performance_summary IS 'Hourly aggregated search performance metrics for monitoring and optimization';

-- Create indexes for common search patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_active_location_search 
ON businesses (active, location) 
WHERE active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_category_search 
ON businesses (category, search_vector_combined) 
WHERE active = true;

COMMIT;

-- Post-migration verification queries (for manual testing)
-- SELECT COUNT(*) FROM businesses WHERE search_vector_combined IS NOT NULL;
-- SELECT 'Migration 005 completed successfully' as status;