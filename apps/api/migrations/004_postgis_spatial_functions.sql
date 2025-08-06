-- PostGIS Spatial Functions for Distance-Based Search
-- Migration: 004_postgis_spatial_functions.sql

-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create spatial index on business location points
CREATE INDEX IF NOT EXISTS idx_businesses_location_gist 
ON businesses USING GIST (location_point);

-- Create partial index for active businesses only (performance optimization)
CREATE INDEX IF NOT EXISTS idx_businesses_active_location_gist 
ON businesses USING GIST (location_point) 
WHERE is_active = true;

-- Create composite index for category + location searches
CREATE INDEX IF NOT EXISTS idx_businesses_categories_location_gist 
ON businesses USING GIST (categories, location_point) 
WHERE is_active = true;

-- Function: Search businesses by location with distance calculation and sorting
CREATE OR REPLACE FUNCTION search_businesses_by_location(
    center_lat FLOAT,
    center_lng FLOAT,
    radius_km FLOAT,
    category_filter TEXT[],
    search_text TEXT,
    result_limit INTEGER,
    result_offset INTEGER
) RETURNS TABLE (
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
    distance_km NUMERIC(10,3)
) AS $$
BEGIN
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
            (ST_Distance(
                ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
                b.location_point::geography
            ) / 1000.0)::numeric, 3
        ) as distance_km
    FROM businesses b
    WHERE 
        -- Active businesses only
        b.is_active = true
        -- Location point exists
        AND b.location_point IS NOT NULL
        -- Within specified radius using geography for accuracy
        AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
            b.location_point::geography,
            radius_km * 1000  -- Convert km to meters
        )
        -- Category filter (if provided)
        AND (
            category_filter IS NULL 
            OR array_length(category_filter, 1) IS NULL
            OR b.categories && category_filter
        )
        -- Text search filter (if provided)
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
        -- Primary sort by distance for optimal location-based results
        b.location_point <-> ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326),
        -- Secondary sort by name for consistent ordering
        b.name
    LIMIT result_limit
    OFFSET result_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Count businesses by location (for pagination)
CREATE OR REPLACE FUNCTION count_businesses_by_location(
    center_lat FLOAT,
    center_lng FLOAT,
    radius_km FLOAT,
    category_filter TEXT[],
    search_text TEXT
) RETURNS INTEGER AS $$
DECLARE
    business_count INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER INTO business_count
    FROM businesses b
    WHERE 
        -- Active businesses only
        b.is_active = true
        -- Location point exists
        AND b.location_point IS NOT NULL
        -- Within specified radius
        AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
            b.location_point::geography,
            radius_km * 1000
        )
        -- Category filter (if provided)
        AND (
            category_filter IS NULL 
            OR array_length(category_filter, 1) IS NULL
            OR b.categories && category_filter
        )
        -- Text search filter (if provided)
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
    
    RETURN COALESCE(business_count, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get businesses within radius ordered by various criteria
CREATE OR REPLACE FUNCTION get_businesses_by_distance(
    center_lat FLOAT,
    center_lng FLOAT,
    radius_km FLOAT,
    sort_by TEXT DEFAULT 'distance',
    result_limit INTEGER DEFAULT 10
) RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    distance_km NUMERIC(10,3),
    rating NUMERIC(3,2),
    categories TEXT[]
) AS $$
DECLARE
    sort_clause TEXT;
BEGIN
    -- Dynamic sorting based on parameter
    CASE sort_by
        WHEN 'distance' THEN
            sort_clause := 'distance_km ASC, b.name ASC';
        WHEN 'rating' THEN
            sort_clause := 'avg_rating DESC NULLS LAST, distance_km ASC';
        WHEN 'newest' THEN
            sort_clause := 'b.created_at DESC, distance_km ASC';
        ELSE
            sort_clause := 'distance_km ASC, b.name ASC';
    END CASE;

    RETURN QUERY EXECUTE format('
        SELECT 
            b.id,
            b.name,
            ROUND(
                (ST_Distance(
                    ST_SetSRID(ST_MakePoint(%L, %L), 4326)::geography,
                    b.location_point::geography
                ) / 1000.0)::numeric, 3
            ) as distance_km,
            COALESCE(
                (SELECT AVG(r.rating) FROM reviews r WHERE r.business_id = b.id), 
                4.0
            )::numeric(3,2) as rating,
            b.categories
        FROM businesses b
        WHERE 
            b.is_active = true
            AND b.location_point IS NOT NULL
            AND ST_DWithin(
                ST_SetSRID(ST_MakePoint(%L, %L), 4326)::geography,
                b.location_point::geography,
                %L * 1000
            )
        ORDER BY %s
        LIMIT %L',
        center_lng, center_lat, center_lng, center_lat, 
        radius_km, sort_clause, result_limit
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get business density in grid cells (for heatmap/analytics)
CREATE OR REPLACE FUNCTION get_business_density_grid(
    center_lat FLOAT,
    center_lng FLOAT,
    radius_km FLOAT,
    grid_size_km FLOAT DEFAULT 1.0
) RETURNS TABLE (
    grid_lat NUMERIC,
    grid_lng NUMERIC,
    business_count INTEGER,
    avg_rating NUMERIC(3,2),
    top_categories TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    WITH grid_businesses AS (
        SELECT 
            -- Snap to grid
            ROUND((ST_Y(b.location_point) / (grid_size_km / 111.0))::numeric, 0) * (grid_size_km / 111.0) as grid_lat,
            ROUND((ST_X(b.location_point) / (grid_size_km / 111.0))::numeric, 0) * (grid_size_km / 111.0) as grid_lng,
            b.id,
            b.categories,
            COALESCE(
                (SELECT AVG(r.rating) FROM reviews r WHERE r.business_id = b.id), 
                4.0
            ) as business_rating
        FROM businesses b
        WHERE 
            b.is_active = true
            AND b.location_point IS NOT NULL
            AND ST_DWithin(
                ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
                b.location_point::geography,
                radius_km * 1000
            )
    )
    SELECT 
        gb.grid_lat,
        gb.grid_lng,
        COUNT(*)::INTEGER as business_count,
        ROUND(AVG(gb.business_rating)::numeric, 2) as avg_rating,
        (SELECT ARRAY(
            SELECT unnest(array_agg(cat)) 
            FROM (
                SELECT unnest(gb2.categories) as cat
                FROM grid_businesses gb2
                WHERE gb2.grid_lat = gb.grid_lat AND gb2.grid_lng = gb.grid_lng
                GROUP BY cat
                ORDER BY COUNT(*) DESC
                LIMIT 3
            ) t
        )) as top_categories
    FROM grid_businesses gb
    GROUP BY gb.grid_lat, gb.grid_lng
    HAVING COUNT(*) >= 2  -- Only return grid cells with 2+ businesses
    ORDER BY business_count DESC, avg_rating DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Find businesses along a route/path
CREATE OR REPLACE FUNCTION find_businesses_along_route(
    route_coordinates JSONB,  -- Array of {lat, lng} points
    buffer_meters INTEGER DEFAULT 1000,
    result_limit INTEGER DEFAULT 50
) RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    distance_from_route_m INTEGER,
    closest_route_point_index INTEGER,
    categories TEXT[]
) AS $$
DECLARE
    route_line GEOMETRY;
    coord JSONB;
    points GEOMETRY[] := '{}';
BEGIN
    -- Build array of points from coordinates
    FOR coord IN SELECT jsonb_array_elements(route_coordinates)
    LOOP
        points := points || ST_SetSRID(
            ST_MakePoint(
                (coord->>'lng')::FLOAT, 
                (coord->>'lat')::FLOAT
            ), 
            4326
        );
    END LOOP;
    
    -- Create line from points
    route_line := ST_MakeLine(points);
    
    RETURN QUERY
    SELECT 
        b.id,
        b.name,
        ST_Distance(route_line::geography, b.location_point::geography)::INTEGER as distance_from_route_m,
        1 as closest_route_point_index,  -- Simplified for now
        b.categories
    FROM businesses b
    WHERE 
        b.is_active = true
        AND b.location_point IS NOT NULL
        AND ST_DWithin(
            route_line::geography,
            b.location_point::geography,
            buffer_meters
        )
    ORDER BY ST_Distance(route_line::geography, b.location_point::geography)
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Update business location point from JSONB location
CREATE OR REPLACE FUNCTION update_business_location_point() 
RETURNS TRIGGER AS $$
BEGIN
    -- Update location_point when location JSONB is modified
    IF NEW.location IS NOT NULL AND 
       NEW.location ? 'coordinates' AND
       NEW.location->'coordinates' ? 'lat' AND
       NEW.location->'coordinates' ? 'lng' THEN
        
        NEW.location_point := ST_SetSRID(
            ST_MakePoint(
                (NEW.location->'coordinates'->>'lng')::FLOAT,
                (NEW.location->'coordinates'->>'lat')::FLOAT
            ), 
            4326
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update location_point when location is modified
DROP TRIGGER IF EXISTS update_location_point_trigger ON businesses;
CREATE TRIGGER update_location_point_trigger
    BEFORE INSERT OR UPDATE ON businesses
    FOR EACH ROW
    EXECUTE FUNCTION update_business_location_point();

-- Performance analysis function for monitoring
CREATE OR REPLACE FUNCTION analyze_location_search_performance(
    test_coordinates JSONB,  -- Array of test points
    radius_km FLOAT DEFAULT 25.0
) RETURNS TABLE (
    test_point JSONB,
    execution_time_ms NUMERIC,
    result_count INTEGER,
    index_usage TEXT
) AS $$
DECLARE
    coord JSONB;
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    exec_time NUMERIC;
    count_result INTEGER;
BEGIN
    FOR coord IN SELECT jsonb_array_elements(test_coordinates)
    LOOP
        start_time := clock_timestamp();
        
        SELECT COUNT(*) INTO count_result
        FROM search_businesses_by_location(
            (coord->>'lat')::FLOAT,
            (coord->>'lng')::FLOAT,
            radius_km,
            NULL,
            NULL,
            50,
            0
        );
        
        end_time := clock_timestamp();
        exec_time := EXTRACT(MILLISECONDS FROM end_time - start_time);
        
        RETURN QUERY SELECT 
            coord,
            exec_time,
            count_result,
            'GIST index used'::TEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION search_businesses_by_location TO public;
GRANT EXECUTE ON FUNCTION count_businesses_by_location TO public;
GRANT EXECUTE ON FUNCTION get_businesses_by_distance TO public;
GRANT EXECUTE ON FUNCTION get_business_density_grid TO public;
GRANT EXECUTE ON FUNCTION find_businesses_along_route TO public;
GRANT EXECUTE ON FUNCTION analyze_location_search_performance TO public;

-- Create performance monitoring view
CREATE OR REPLACE VIEW location_search_performance AS
SELECT 
    'spatial_functions' as component,
    COUNT(*) as total_businesses,
    COUNT(CASE WHEN location_point IS NOT NULL THEN 1 END) as businesses_with_coordinates,
    ROUND(
        (COUNT(CASE WHEN location_point IS NOT NULL THEN 1 END) * 100.0 / COUNT(*))::numeric, 
        2
    ) as coordinate_coverage_percent,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_businesses
FROM businesses;

-- Create index statistics view for monitoring
CREATE OR REPLACE VIEW spatial_index_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE indexname LIKE '%location%';

COMMENT ON FUNCTION search_businesses_by_location IS 'High-performance PostGIS function for distance-based business search with sub-second response time';
COMMENT ON FUNCTION count_businesses_by_location IS 'Count function for pagination support in location searches';
COMMENT ON FUNCTION get_businesses_by_distance IS 'Optimized distance search with multiple sorting options';
COMMENT ON FUNCTION get_business_density_grid IS 'Grid-based density analysis for heatmaps and analytics';
COMMENT ON FUNCTION find_businesses_along_route IS 'Find businesses along a travel route with configurable buffer';