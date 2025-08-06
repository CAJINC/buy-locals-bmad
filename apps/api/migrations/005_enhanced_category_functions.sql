-- Migration: Enhanced Category Functions
-- Description: Add comprehensive category filtering support with hierarchy and popularity tracking
-- Date: 2025-01-06

BEGIN;

-- Drop existing functions to recreate with enhanced category support
DROP FUNCTION IF EXISTS search_businesses_by_location(FLOAT, FLOAT, FLOAT, TEXT[], TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS count_businesses_by_location(FLOAT, FLOAT, FLOAT, TEXT[], TEXT);

-- Enhanced search function with multiple category filtering (OR logic)
CREATE OR REPLACE FUNCTION search_businesses_by_location(
    search_lat FLOAT,
    search_lng FLOAT, 
    search_radius_km FLOAT,
    category_filter TEXT[],
    search_text TEXT,
    result_limit INTEGER,
    result_offset INTEGER
)
RETURNS TABLE(
    id UUID,
    owner_id UUID,
    name VARCHAR(255),
    description TEXT,
    location JSONB,
    categories TEXT[],
    hours JSONB,
    contact JSONB,
    services JSONB,
    is_active BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    location_point GEOMETRY(POINT, 4326),
    distance_km NUMERIC(8,3),
    avg_rating NUMERIC(3,2),
    review_count INTEGER
)
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
    search_point GEOMETRY;
BEGIN
    -- Create search point
    search_point := ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326);
    
    RETURN QUERY
    SELECT 
        b.id,
        b.owner_id,
        b.name,
        b.description,
        b.location,
        b.categories,
        b.hours,
        b.contact,
        b.services,
        b.is_active,
        b.created_at,
        b.updated_at,
        b.location_point,
        ROUND(
            (ST_Distance(search_point::geography, b.location_point::geography) / 1000.0)::numeric, 3
        ) as distance_km,
        COALESCE(
            (SELECT AVG(r.rating) FROM reviews r WHERE r.business_id = b.id), 
            4.0
        )::numeric(3,2) as avg_rating,
        (SELECT COUNT(*) FROM reviews r WHERE r.business_id = b.id)::integer as review_count
    FROM businesses b
    WHERE 
        b.is_active = true
        AND b.location_point IS NOT NULL
        AND ST_DWithin(
            search_point::geography,
            b.location_point::geography,
            search_radius_km * 1000
        )
        -- Enhanced category filtering with OR logic
        AND (
            category_filter IS NULL 
            OR array_length(category_filter, 1) IS NULL
            OR b.categories && category_filter  -- Overlap operator for OR logic
        )
        -- Enhanced text search with ranking
        AND (
            search_text IS NULL 
            OR search_text = ''
            OR (
                b.name ILIKE '%' || search_text || '%'
                OR b.description ILIKE '%' || search_text || '%'
                OR EXISTS (
                    SELECT 1 FROM unnest(b.categories) cat 
                    WHERE cat ILIKE '%' || search_text || '%'
                )
            )
        )
    ORDER BY 
        -- Prioritize exact name matches
        CASE WHEN search_text IS NOT NULL AND b.name ILIKE search_text THEN 1 ELSE 2 END,
        -- Then by distance
        b.location_point <-> search_point,
        -- Then by rating and popularity
        (SELECT AVG(r.rating) FROM reviews r WHERE r.business_id = b.id) DESC NULLS LAST,
        b.created_at DESC
    LIMIT result_limit OFFSET result_offset;
END;
$$;

-- Enhanced count function with multiple category filtering
CREATE OR REPLACE FUNCTION count_businesses_by_location(
    search_lat FLOAT,
    search_lng FLOAT,
    search_radius_km FLOAT,
    category_filter TEXT[],
    search_text TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
    search_point GEOMETRY;
    result_count INTEGER;
BEGIN
    -- Create search point
    search_point := ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326);
    
    SELECT COUNT(*)::integer INTO result_count
    FROM businesses b
    WHERE 
        b.is_active = true
        AND b.location_point IS NOT NULL
        AND ST_DWithin(
            search_point::geography,
            b.location_point::geography,
            search_radius_km * 1000
        )
        -- Enhanced category filtering with OR logic
        AND (
            category_filter IS NULL 
            OR array_length(category_filter, 1) IS NULL
            OR b.categories && category_filter  -- Overlap operator for OR logic
        )
        -- Enhanced text search
        AND (
            search_text IS NULL 
            OR search_text = ''
            OR (
                b.name ILIKE '%' || search_text || '%'
                OR b.description ILIKE '%' || search_text || '%'
                OR EXISTS (
                    SELECT 1 FROM unnest(b.categories) cat 
                    WHERE cat ILIKE '%' || search_text || '%'
                )
            )
        );
    
    RETURN result_count;
END;
$$;

-- Function to get category aggregation for a location
CREATE OR REPLACE FUNCTION get_category_aggregation(
    search_lat FLOAT,
    search_lng FLOAT,
    search_radius_km FLOAT DEFAULT 25,
    include_subcategories BOOLEAN DEFAULT true
)
RETURNS TABLE(
    category TEXT,
    business_count INTEGER,
    avg_rating NUMERIC(3,2),
    percentage NUMERIC(5,2)
)
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
    search_point GEOMETRY;
    total_businesses INTEGER;
BEGIN
    -- Create search point
    search_point := ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326);
    
    -- Get total business count for percentage calculation
    SELECT COUNT(*)::integer INTO total_businesses
    FROM businesses b
    WHERE 
        b.is_active = true
        AND b.location_point IS NOT NULL
        AND ST_DWithin(
            search_point::geography,
            b.location_point::geography,
            search_radius_km * 1000
        );
    
    -- Return category aggregation
    RETURN QUERY
    WITH location_businesses AS (
        SELECT 
            b.categories,
            (SELECT AVG(rating) FROM reviews WHERE business_id = b.id) as avg_rating
        FROM businesses b
        WHERE 
            b.is_active = true
            AND b.location_point IS NOT NULL
            AND ST_DWithin(
                search_point::geography,
                b.location_point::geography,
                search_radius_km * 1000
            )
    ),
    category_stats AS (
        SELECT 
            unnest(categories) as cat,
            COUNT(*) as count,
            AVG(COALESCE(avg_rating, 4.0)) as avg_rating
        FROM location_businesses
        GROUP BY cat
    )
    SELECT 
        cat as category,
        count::integer as business_count,
        ROUND(avg_rating::numeric, 2) as avg_rating,
        CASE 
            WHEN total_businesses > 0 THEN ROUND((count::float / total_businesses * 100)::numeric, 2)
            ELSE 0::numeric
        END as percentage
    FROM category_stats
    WHERE count > 0
    ORDER BY count DESC, cat;
END;
$$;

-- Function to get popular categories in a location with trend analysis
CREATE OR REPLACE FUNCTION get_trending_categories(
    search_lat FLOAT,
    search_lng FLOAT,
    search_radius_km FLOAT DEFAULT 25,
    result_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    category TEXT,
    business_count INTEGER,
    avg_rating NUMERIC(3,2),
    recent_businesses INTEGER,
    trend_score INTEGER
)
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
    search_point GEOMETRY;
    recent_cutoff TIMESTAMP;
BEGIN
    -- Create search point and recent cutoff (30 days)
    search_point := ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326);
    recent_cutoff := NOW() - INTERVAL '30 days';
    
    RETURN QUERY
    WITH location_businesses AS (
        SELECT 
            b.categories,
            b.created_at,
            (SELECT AVG(rating) FROM reviews WHERE business_id = b.id) as avg_rating
        FROM businesses b
        WHERE 
            b.is_active = true
            AND b.location_point IS NOT NULL
            AND ST_DWithin(
                search_point::geography,
                b.location_point::geography,
                search_radius_km * 1000
            )
    ),
    category_trends AS (
        SELECT 
            unnest(categories) as cat,
            COUNT(*) as total_count,
            COUNT(*) FILTER (WHERE created_at >= recent_cutoff) as recent_count,
            AVG(COALESCE(avg_rating, 4.0)) as avg_rating
        FROM location_businesses
        GROUP BY cat
    )
    SELECT 
        cat as category,
        total_count::integer as business_count,
        ROUND(avg_rating::numeric, 2) as avg_rating,
        recent_count::integer as recent_businesses,
        -- Trend score: recent activity + rating bonus
        (recent_count * 10 + ROUND(avg_rating * 5))::integer as trend_score
    FROM category_trends
    WHERE total_count > 0
    ORDER BY trend_score DESC, total_count DESC
    LIMIT result_limit;
END;
$$;

-- Function for category-based business recommendations
CREATE OR REPLACE FUNCTION get_category_recommendations(
    search_lat FLOAT,
    search_lng FLOAT,
    user_categories TEXT[],
    search_radius_km FLOAT DEFAULT 25,
    result_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
    id UUID,
    name VARCHAR(255),
    categories TEXT[],
    distance_km NUMERIC(8,3),
    avg_rating NUMERIC(3,2),
    review_count INTEGER,
    match_score INTEGER
)
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
    search_point GEOMETRY;
BEGIN
    -- Create search point
    search_point := ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326);
    
    RETURN QUERY
    SELECT 
        b.id,
        b.name,
        b.categories,
        ROUND(
            (ST_Distance(search_point::geography, b.location_point::geography) / 1000.0)::numeric, 3
        ) as distance_km,
        COALESCE(
            (SELECT AVG(r.rating) FROM reviews r WHERE r.business_id = b.id), 
            4.0
        )::numeric(3,2) as avg_rating,
        (SELECT COUNT(*) FROM reviews r WHERE r.business_id = b.id)::integer as review_count,
        -- Calculate match score based on category overlap and other factors
        (
            -- Category match bonus (50 points max)
            (SELECT COUNT(*) FROM unnest(b.categories) cat WHERE cat = ANY(user_categories)) * 25 +
            -- Rating bonus (25 points max) 
            ROUND((SELECT AVG(r.rating) FROM reviews r WHERE r.business_id = b.id) * 5)::integer +
            -- Popularity bonus (25 points max)
            LEAST((SELECT COUNT(*) FROM reviews r WHERE r.business_id = b.id), 5) * 5
        )::integer as match_score
    FROM businesses b
    WHERE 
        b.is_active = true
        AND b.location_point IS NOT NULL
        AND ST_DWithin(
            search_point::geography,
            b.location_point::geography,
            search_radius_km * 1000
        )
        -- Must have at least one matching category
        AND (
            user_categories IS NULL 
            OR array_length(user_categories, 1) IS NULL
            OR b.categories && user_categories
        )
    ORDER BY 
        match_score DESC,
        -- Secondary sort by distance
        b.location_point <-> search_point,
        -- Tertiary sort by rating
        (SELECT AVG(r.rating) FROM reviews r WHERE r.business_id = b.id) DESC NULLS LAST
    LIMIT result_limit;
END;
$$;

-- Create indexes for enhanced category filtering performance
CREATE INDEX IF NOT EXISTS idx_businesses_categories_gin 
ON businesses USING gin(categories);

CREATE INDEX IF NOT EXISTS idx_businesses_location_categories 
ON businesses(location_point, categories) 
WHERE is_active = true;

-- Add compound index for location + category queries
CREATE INDEX IF NOT EXISTS idx_businesses_spatial_category_performance
ON businesses USING gist(location_point, categories)
WHERE is_active = true;

-- Create materialized view for category analytics (optional, for high-traffic scenarios)
CREATE MATERIALIZED VIEW IF NOT EXISTS category_business_stats AS
WITH category_stats AS (
    SELECT 
        unnest(categories) as category,
        COUNT(*) as business_count,
        AVG(COALESCE((SELECT AVG(rating) FROM reviews WHERE business_id = businesses.id), 4.0)) as avg_rating,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as recent_count
    FROM businesses
    WHERE is_active = true
    GROUP BY category
)
SELECT 
    category,
    business_count::integer,
    ROUND(avg_rating::numeric, 2) as avg_rating,
    recent_count::integer,
    -- Popularity score calculation
    (business_count + recent_count * 5 + ROUND(avg_rating * 10))::integer as popularity_score,
    NOW() as last_updated
FROM category_stats
WHERE business_count > 0
ORDER BY popularity_score DESC;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_category_business_stats_category 
ON category_business_stats(category);

-- Function to refresh category stats (should be called periodically)
CREATE OR REPLACE FUNCTION refresh_category_stats()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY category_business_stats;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION search_businesses_by_location(FLOAT, FLOAT, FLOAT, TEXT[], TEXT, INTEGER, INTEGER) IS 
'Enhanced PostGIS search with multiple category filtering (OR logic), text search, and optimized performance';

COMMENT ON FUNCTION count_businesses_by_location(FLOAT, FLOAT, FLOAT, TEXT[], TEXT) IS 
'Count businesses matching location and category criteria for pagination';

COMMENT ON FUNCTION get_category_aggregation(FLOAT, FLOAT, FLOAT, BOOLEAN) IS 
'Get category distribution and statistics for a geographic area';

COMMENT ON FUNCTION get_trending_categories(FLOAT, FLOAT, FLOAT, INTEGER) IS 
'Get trending categories based on recent business additions and ratings';

COMMENT ON FUNCTION get_category_recommendations(FLOAT, FLOAT, TEXT[], FLOAT, INTEGER) IS 
'Get personalized business recommendations based on user category preferences';

COMMENT ON MATERIALIZED VIEW category_business_stats IS 
'Pre-computed category statistics for performance optimization';

COMMIT;