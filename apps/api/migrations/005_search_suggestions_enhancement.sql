-- Migration: Enhanced Search Suggestions and Autocomplete Support
-- Description: Adds database functions, indexes, and extensions for high-performance search suggestions

-- Enable PostgreSQL extensions for advanced text search and similarity
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Create indexes for trigram similarity search on business names
CREATE INDEX IF NOT EXISTS idx_businesses_name_trgm 
ON businesses USING gin (name gin_trgm_ops);

-- Create indexes for category-based suggestions
CREATE INDEX IF NOT EXISTS idx_businesses_categories_gin 
ON businesses USING gin (categories);

-- Create combined index for location + category searches
CREATE INDEX IF NOT EXISTS idx_businesses_location_categories 
ON businesses USING gist (location_point, categories) 
WHERE is_active = true;

-- Create index for business name prefix searches
CREATE INDEX IF NOT EXISTS idx_businesses_name_prefix 
ON businesses (lower(name) text_pattern_ops) 
WHERE is_active = true;

-- Create index for full-text search on business names and descriptions
CREATE INDEX IF NOT EXISTS idx_businesses_fulltext 
ON businesses USING gin (to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Create search analytics table
CREATE TABLE IF NOT EXISTS search_analytics (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(100),
    query TEXT NOT NULL,
    suggestion_id VARCHAR(100),
    suggestion_type VARCHAR(50) NOT NULL, -- 'business', 'category', 'trending', etc.
    event_type VARCHAR(50) NOT NULL, -- 'impression', 'click', 'conversion'
    position INTEGER, -- Position in suggestion list
    location_point GEOGRAPHY(POINT, 4326),
    context JSONB, -- User context and metadata
    response_time INTEGER, -- Response time in milliseconds
    result_count INTEGER, -- Number of results returned
    conversion_value DECIMAL(10,2), -- Value of conversion if applicable
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for analytics queries
    INDEX (created_at),
    INDEX (session_id),
    INDEX (query),
    INDEX (suggestion_type),
    INDEX (event_type),
    INDEX USING gist (location_point),
    INDEX USING gin (context)
);

-- Create search query cache table for popular/trending queries
CREATE TABLE IF NOT EXISTS search_query_cache (
    id BIGSERIAL PRIMARY KEY,
    query_hash VARCHAR(64) UNIQUE NOT NULL, -- Hash of normalized query
    query TEXT NOT NULL,
    category VARCHAR(100),
    location_point GEOGRAPHY(POINT, 4326),
    search_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,
    avg_response_time INTEGER DEFAULT 0,
    avg_result_count INTEGER DEFAULT 0,
    avg_rating DECIMAL(3,2) DEFAULT 0,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_trending BOOLEAN DEFAULT FALSE,
    trend_score DECIMAL(5,2) DEFAULT 0,
    
    -- Indexes for query analysis
    INDEX (query_hash),
    INDEX (search_count DESC),
    INDEX (is_trending, trend_score DESC),
    INDEX (last_seen DESC),
    INDEX USING gist (location_point)
);

-- Function: Get business name suggestions with fuzzy matching
CREATE OR REPLACE FUNCTION get_business_name_suggestions(
    search_query TEXT,
    user_lat FLOAT DEFAULT NULL,
    user_lng FLOAT DEFAULT NULL,
    search_radius FLOAT DEFAULT 10,
    result_limit INTEGER DEFAULT 5,
    min_similarity FLOAT DEFAULT 0.3
)
RETURNS TABLE (
    business_id UUID,
    name TEXT,
    similarity_score FLOAT,
    categories TEXT[],
    address TEXT,
    lat FLOAT,
    lng FLOAT,
    distance_km FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id as business_id,
        b.name,
        similarity(b.name, search_query) as similarity_score,
        b.categories,
        b.address,
        ST_Y(b.location_point) as lat,
        ST_X(b.location_point) as lng,
        CASE 
            WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
                ROUND(
                    (ST_Distance(
                        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
                        b.location_point::geography
                    ) / 1000.0)::numeric, 2
                )::FLOAT
            ELSE NULL
        END as distance_km
    FROM businesses b
    WHERE 
        b.is_active = true
        AND similarity(b.name, search_query) > min_similarity
        AND (
            user_lat IS NULL OR user_lng IS NULL OR
            ST_DWithin(
                ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
                b.location_point::geography,
                search_radius * 1000
            )
        )
    ORDER BY 
        similarity(b.name, search_query) DESC,
        CASE 
            WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
                ST_Distance(b.location_point, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326))
            ELSE 0
        END ASC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Function: Get category suggestions with location-based popularity
CREATE OR REPLACE FUNCTION get_category_suggestions(
    search_query TEXT DEFAULT '',
    user_lat FLOAT DEFAULT NULL,
    user_lng FLOAT DEFAULT NULL,
    search_radius FLOAT DEFAULT 25,
    result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    category TEXT,
    business_count BIGINT,
    popularity_score FLOAT,
    avg_rating DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH category_stats AS (
        SELECT 
            unnest(b.categories) as category,
            COUNT(*) as business_count,
            AVG(COALESCE((
                SELECT AVG(rating) 
                FROM reviews r 
                WHERE r.business_id = b.id
            ), 4.0)) as avg_rating
        FROM businesses b
        WHERE 
            b.is_active = true
            AND (
                user_lat IS NULL OR user_lng IS NULL OR
                ST_DWithin(
                    ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
                    b.location_point::geography,
                    search_radius * 1000
                )
            )
        GROUP BY unnest(b.categories)
    )
    SELECT 
        cs.category,
        cs.business_count,
        -- Popularity score based on business count and rating
        (cs.business_count::FLOAT * (cs.avg_rating / 5.0)) as popularity_score,
        ROUND(cs.avg_rating::numeric, 2) as avg_rating
    FROM category_stats cs
    WHERE 
        cs.business_count >= 3
        AND (
            search_query = '' OR 
            cs.category ILIKE '%' || search_query || '%' OR
            similarity(cs.category, search_query) > 0.3
        )
    ORDER BY 
        CASE WHEN search_query != '' THEN similarity(cs.category, search_query) ELSE 0 END DESC,
        popularity_score DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Function: Update search query cache with analytics data
CREATE OR REPLACE FUNCTION update_search_query_cache(
    query_text TEXT,
    query_category TEXT DEFAULT NULL,
    user_lat FLOAT DEFAULT NULL,
    user_lng FLOAT DEFAULT NULL,
    response_time INTEGER DEFAULT NULL,
    result_count INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    query_hash_value VARCHAR(64);
    location_point_value GEOGRAPHY(POINT, 4326);
BEGIN
    -- Generate hash for query (normalized)
    query_hash_value := encode(digest(lower(trim(query_text)), 'sha256'), 'hex');
    
    -- Create location point if coordinates provided
    IF user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
        location_point_value := ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography;
    END IF;
    
    -- Insert or update query cache
    INSERT INTO search_query_cache (
        query_hash,
        query,
        category,
        location_point,
        search_count,
        avg_response_time,
        avg_result_count,
        last_seen
    ) VALUES (
        query_hash_value,
        query_text,
        query_category,
        location_point_value,
        1,
        COALESCE(response_time, 0),
        COALESCE(result_count, 0),
        NOW()
    )
    ON CONFLICT (query_hash) DO UPDATE SET
        search_count = search_query_cache.search_count + 1,
        avg_response_time = (
            (search_query_cache.avg_response_time * search_query_cache.search_count + COALESCE(response_time, 0))
            / (search_query_cache.search_count + 1)
        )::INTEGER,
        avg_result_count = (
            (search_query_cache.avg_result_count * search_query_cache.search_count + COALESCE(result_count, 0))
            / (search_query_cache.search_count + 1)
        )::INTEGER,
        last_seen = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function: Get trending queries based on recent activity
CREATE OR REPLACE FUNCTION get_trending_queries(
    user_lat FLOAT DEFAULT NULL,
    user_lng FLOAT DEFAULT NULL,
    search_radius FLOAT DEFAULT 50,
    result_limit INTEGER DEFAULT 10,
    hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
    query TEXT,
    category TEXT,
    recent_searches BIGINT,
    growth_rate FLOAT,
    avg_rating DECIMAL
) AS $$
DECLARE
    cutoff_time TIMESTAMP WITH TIME ZONE;
BEGIN
    cutoff_time := NOW() - INTERVAL '1 hour' * hours_back;
    
    RETURN QUERY
    WITH recent_activity AS (
        SELECT 
            sqc.query,
            sqc.category,
            COUNT(*) as recent_searches,
            AVG(sqc.avg_rating) as avg_rating
        FROM search_query_cache sqc
        WHERE 
            sqc.last_seen >= cutoff_time
            AND (
                user_lat IS NULL OR user_lng IS NULL OR
                ST_DWithin(
                    ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
                    sqc.location_point::geography,
                    search_radius * 1000
                )
            )
        GROUP BY sqc.query, sqc.category
    ),
    historical_activity AS (
        SELECT 
            sqc.query,
            COUNT(*) as historical_searches
        FROM search_query_cache sqc
        WHERE 
            sqc.first_seen < cutoff_time
            AND (
                user_lat IS NULL OR user_lng IS NULL OR
                ST_DWithin(
                    ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
                    sqc.location_point::geography,
                    search_radius * 1000
                )
            )
        GROUP BY sqc.query
    )
    SELECT 
        ra.query,
        ra.category,
        ra.recent_searches,
        CASE 
            WHEN ha.historical_searches > 0 THEN
                ((ra.recent_searches - ha.historical_searches)::FLOAT / ha.historical_searches::FLOAT) * 100
            ELSE 100.0 -- New queries get 100% growth
        END as growth_rate,
        ROUND(ra.avg_rating::numeric, 2) as avg_rating
    FROM recent_activity ra
    LEFT JOIN historical_activity ha ON ra.query = ha.query
    WHERE ra.recent_searches >= 3 -- Minimum threshold for trending
    ORDER BY 
        CASE 
            WHEN ha.historical_searches > 0 THEN
                ((ra.recent_searches - ha.historical_searches)::FLOAT / ha.historical_searches::FLOAT)
            ELSE 1.0
        END DESC,
        ra.recent_searches DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Function: Get popular queries based on historical data
CREATE OR REPLACE FUNCTION get_popular_queries(
    user_lat FLOAT DEFAULT NULL,
    user_lng FLOAT DEFAULT NULL,
    search_radius FLOAT DEFAULT 25,
    result_limit INTEGER DEFAULT 10,
    days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    query TEXT,
    category TEXT,
    total_searches BIGINT,
    click_count INTEGER,
    conversion_count INTEGER,
    avg_rating DECIMAL,
    popularity_score FLOAT
) AS $$
DECLARE
    cutoff_time TIMESTAMP WITH TIME ZONE;
BEGIN
    cutoff_time := NOW() - INTERVAL '1 day' * days_back;
    
    RETURN QUERY
    SELECT 
        sqc.query,
        sqc.category,
        sqc.search_count::BIGINT as total_searches,
        sqc.click_count,
        sqc.conversion_count,
        ROUND(sqc.avg_rating::numeric, 2) as avg_rating,
        -- Popularity score combining searches, CTR, and ratings
        (
            sqc.search_count::FLOAT * 0.4 +
            (CASE WHEN sqc.search_count > 0 THEN (sqc.click_count::FLOAT / sqc.search_count::FLOAT) ELSE 0 END) * 100 * 0.3 +
            (sqc.avg_rating / 5.0) * 100 * 0.3
        ) as popularity_score
    FROM search_query_cache sqc
    WHERE 
        sqc.last_seen >= cutoff_time
        AND sqc.search_count >= 5 -- Minimum search threshold
        AND (
            user_lat IS NULL OR user_lng IS NULL OR
            ST_DWithin(
                ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
                sqc.location_point::geography,
                search_radius * 1000
            )
        )
    ORDER BY 
        popularity_score DESC,
        sqc.search_count DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Function: Track search analytics event
CREATE OR REPLACE FUNCTION track_search_analytics(
    session_id_param VARCHAR(100),
    user_id_param VARCHAR(100) DEFAULT NULL,
    query_param TEXT,
    suggestion_id_param VARCHAR(100) DEFAULT NULL,
    suggestion_type_param VARCHAR(50),
    event_type_param VARCHAR(50),
    position_param INTEGER DEFAULT NULL,
    user_lat FLOAT DEFAULT NULL,
    user_lng FLOAT DEFAULT NULL,
    context_param JSONB DEFAULT NULL,
    response_time_param INTEGER DEFAULT NULL,
    result_count_param INTEGER DEFAULT NULL,
    conversion_value_param DECIMAL(10,2) DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    location_point_value GEOGRAPHY(POINT, 4326);
BEGIN
    -- Create location point if coordinates provided
    IF user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
        location_point_value := ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography;
    END IF;
    
    -- Insert analytics event
    INSERT INTO search_analytics (
        session_id,
        user_id,
        query,
        suggestion_id,
        suggestion_type,
        event_type,
        position,
        location_point,
        context,
        response_time,
        result_count,
        conversion_value
    ) VALUES (
        session_id_param,
        user_id_param,
        query_param,
        suggestion_id_param,
        suggestion_type_param,
        event_type_param,
        position_param,
        location_point_value,
        context_param,
        response_time_param,
        result_count_param,
        conversion_value_param
    );
    
    -- Update query cache for search events
    IF event_type_param = 'search' THEN
        PERFORM update_search_query_cache(
            query_param,
            NULL, -- category would be extracted from context if available
            user_lat,
            user_lng,
            response_time_param,
            result_count_param
        );
    END IF;
    
    -- Update click/conversion counts in query cache
    IF event_type_param IN ('click', 'conversion') THEN
        UPDATE search_query_cache 
        SET 
            click_count = CASE WHEN event_type_param = 'click' THEN click_count + 1 ELSE click_count END,
            conversion_count = CASE WHEN event_type_param = 'conversion' THEN conversion_count + 1 ELSE conversion_count END
        WHERE query_hash = encode(digest(lower(trim(query_param)), 'sha256'), 'hex');
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: Get search analytics summary
CREATE OR REPLACE FUNCTION get_search_analytics_summary(
    hours_back INTEGER DEFAULT 24,
    user_lat FLOAT DEFAULT NULL,
    user_lng FLOAT DEFAULT NULL,
    search_radius FLOAT DEFAULT NULL
)
RETURNS TABLE (
    total_searches BIGINT,
    total_suggestions BIGINT,
    total_clicks BIGINT,
    total_conversions BIGINT,
    avg_ctr FLOAT,
    avg_cvr FLOAT,
    avg_response_time FLOAT,
    unique_queries BIGINT,
    unique_sessions BIGINT
) AS $$
DECLARE
    cutoff_time TIMESTAMP WITH TIME ZONE;
BEGIN
    cutoff_time := NOW() - INTERVAL '1 hour' * hours_back;
    
    RETURN QUERY
    WITH filtered_analytics AS (
        SELECT *
        FROM search_analytics sa
        WHERE 
            sa.created_at >= cutoff_time
            AND (
                user_lat IS NULL OR user_lng IS NULL OR search_radius IS NULL OR
                ST_DWithin(
                    ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
                    sa.location_point::geography,
                    search_radius * 1000
                )
            )
    )
    SELECT 
        COUNT(*) FILTER (WHERE event_type = 'search') as total_searches,
        COUNT(*) FILTER (WHERE event_type = 'impression') as total_suggestions,
        COUNT(*) FILTER (WHERE event_type = 'click') as total_clicks,
        COUNT(*) FILTER (WHERE event_type = 'conversion') as total_conversions,
        CASE 
            WHEN COUNT(*) FILTER (WHERE event_type = 'impression') > 0 THEN
                (COUNT(*) FILTER (WHERE event_type = 'click')::FLOAT / 
                 COUNT(*) FILTER (WHERE event_type = 'impression')::FLOAT) * 100
            ELSE 0
        END as avg_ctr,
        CASE 
            WHEN COUNT(*) FILTER (WHERE event_type = 'click') > 0 THEN
                (COUNT(*) FILTER (WHERE event_type = 'conversion')::FLOAT / 
                 COUNT(*) FILTER (WHERE event_type = 'click')::FLOAT) * 100
            ELSE 0
        END as avg_cvr,
        AVG(response_time)::FLOAT as avg_response_time,
        COUNT(DISTINCT query) as unique_queries,
        COUNT(DISTINCT session_id) as unique_sessions
    FROM filtered_analytics;
END;
$$ LANGUAGE plpgsql;

-- Create partitioned table for high-volume analytics (optional optimization)
-- This would be useful for very high traffic scenarios
CREATE TABLE IF NOT EXISTS search_analytics_partitioned (
    LIKE search_analytics INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for the current and next few months
-- This would be managed by a maintenance process in production
DO $$
DECLARE
    start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
    end_date DATE;
    partition_name TEXT;
BEGIN
    FOR i IN 0..5 LOOP
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'search_analytics_' || TO_CHAR(start_date, 'YYYY_MM');
        
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF search_analytics_partitioned 
                       FOR VALUES FROM (%L) TO (%L)', 
                       partition_name, start_date, end_date);
        
        start_date := end_date;
    END LOOP;
END $$;

-- Create maintenance functions for cleanup and optimization
CREATE OR REPLACE FUNCTION cleanup_old_search_analytics(
    days_to_keep INTEGER DEFAULT 90
)
RETURNS INTEGER AS $$
DECLARE
    cutoff_date TIMESTAMP WITH TIME ZONE;
    deleted_count INTEGER;
BEGIN
    cutoff_date := NOW() - INTERVAL '1 day' * days_to_keep;
    
    DELETE FROM search_analytics 
    WHERE created_at < cutoff_date;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to update trending flags
CREATE OR REPLACE FUNCTION update_trending_flags()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Reset all trending flags
    UPDATE search_query_cache SET is_trending = FALSE, trend_score = 0;
    
    -- Mark queries as trending based on recent activity
    WITH trending_candidates AS (
        SELECT 
            query_hash,
            CASE 
                WHEN search_count > 0 THEN
                    (
                        -- Recent activity weight (last 24 hours)
                        CASE WHEN last_seen >= NOW() - INTERVAL '24 hours' THEN 1.0 ELSE 0.5 END *
                        -- Search volume weight
                        (search_count::FLOAT / 100.0) *
                        -- Click rate weight
                        (CASE WHEN search_count > 0 THEN (click_count::FLOAT / search_count::FLOAT) ELSE 0 END) *
                        -- Rating weight
                        (avg_rating / 5.0)
                    )
                ELSE 0
            END as trend_score
        FROM search_query_cache
        WHERE last_seen >= NOW() - INTERVAL '7 days'
    )
    UPDATE search_query_cache 
    SET 
        is_trending = TRUE,
        trend_score = tc.trend_score
    FROM trending_candidates tc
    WHERE 
        search_query_cache.query_hash = tc.query_hash
        AND tc.trend_score > 0.1; -- Minimum threshold for trending
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Create scheduled job to update trending flags (would be called by cron or scheduler)
-- This is commented out as it requires pg_cron extension
-- SELECT cron.schedule('update-trending', '0 */6 * * *', 'SELECT update_trending_flags();');

-- Grant permissions for application user
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON search_analytics TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON search_query_cache TO app_user;

-- Create comment documentation
COMMENT ON FUNCTION get_business_name_suggestions IS 'Fast business name autocomplete with PostgreSQL trigram similarity';
COMMENT ON FUNCTION get_category_suggestions IS 'Location-based category suggestions with popularity scoring';
COMMENT ON FUNCTION get_trending_queries IS 'Trending search queries based on recent growth patterns';
COMMENT ON FUNCTION get_popular_queries IS 'Popular historical search queries with engagement metrics';
COMMENT ON FUNCTION track_search_analytics IS 'Track search and suggestion analytics events';
COMMENT ON FUNCTION update_search_query_cache IS 'Update search query cache with performance metrics';
COMMENT ON FUNCTION get_search_analytics_summary IS 'Get comprehensive search analytics summary';
COMMENT ON TABLE search_analytics IS 'Comprehensive search and suggestion analytics tracking';
COMMENT ON TABLE search_query_cache IS 'Cache of search queries with performance and popularity metrics';