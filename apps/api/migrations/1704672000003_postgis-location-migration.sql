-- PostGIS Location Migration for Story 2.2
-- Zero-downtime migration to spatial geometry columns
-- Adds optimized spatial indexes for sub-1-second queries

-- Step 1: Add new geometry column for spatial queries
ALTER TABLE businesses 
ADD COLUMN location_point GEOMETRY(POINT, 4326);

-- Step 2: Create function to extract coordinates from JSONB location
CREATE OR REPLACE FUNCTION extract_coordinates_from_location(location_data JSONB)
RETURNS GEOMETRY AS $$
BEGIN
    -- Extract latitude and longitude from nested JSONB structure
    IF location_data ? 'coordinates' THEN
        -- New format: location.coordinates.lat/lng
        RETURN ST_SetSRID(
            ST_MakePoint(
                (location_data->'coordinates'->>'lng')::float,
                (location_data->'coordinates'->>'lat')::float
            ), 
            4326
        );
    ELSIF location_data ? 'latitude' AND location_data ? 'longitude' THEN
        -- Alternative format: location.latitude/longitude
        RETURN ST_SetSRID(
            ST_MakePoint(
                (location_data->>'longitude')::float,
                (location_data->>'latitude')::float
            ), 
            4326
        );
    ELSE
        RETURN NULL;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 3: Populate geometry column from existing JSONB data
UPDATE businesses 
SET location_point = extract_coordinates_from_location(location)
WHERE location IS NOT NULL 
  AND (
    (location ? 'coordinates' AND location->'coordinates' ? 'lat' AND location->'coordinates' ? 'lng')
    OR (location ? 'latitude' AND location ? 'longitude')
  );

-- Step 4: Create spatial index for ultra-fast location queries
CREATE INDEX CONCURRENTLY idx_businesses_location_gist 
ON businesses USING GIST (location_point)
WHERE location_point IS NOT NULL AND is_active = true;

-- Step 5: Create additional indexes for combined queries
CREATE INDEX CONCURRENTLY idx_businesses_location_categories 
ON businesses USING GIN (categories)
WHERE location_point IS NOT NULL AND is_active = true;

CREATE INDEX CONCURRENTLY idx_businesses_location_active_created 
ON businesses (is_active, created_at)
WHERE location_point IS NOT NULL;

-- Step 6: Create trigger to automatically update geometry on location changes
CREATE OR REPLACE FUNCTION update_location_point()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location_point = extract_coordinates_from_location(NEW.location);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER businesses_location_point_trigger
    BEFORE INSERT OR UPDATE OF location ON businesses
    FOR EACH ROW EXECUTE FUNCTION update_location_point();

-- Step 7: Create optimized search function for location-based queries
CREATE OR REPLACE FUNCTION search_businesses_by_location(
    search_lat FLOAT,
    search_lng FLOAT,
    radius_km FLOAT DEFAULT 25,
    category_filter TEXT[] DEFAULT NULL,
    search_text TEXT DEFAULT NULL,
    limit_count INTEGER DEFAULT 10,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    description TEXT,
    location JSONB,
    categories TEXT[],
    hours JSONB,
    contact JSONB,
    media JSONB,
    services JSONB,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    distance_km FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.name,
        b.description,
        b.location,
        b.categories,
        b.hours,
        b.contact,
        b.media,
        b.services,
        b.is_active,
        b.created_at,
        b.updated_at,
        ST_Distance(
            ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography,
            b.location_point::geography
        ) / 1000.0 AS distance_km
    FROM businesses b
    WHERE b.is_active = true
        AND b.location_point IS NOT NULL
        AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography,
            b.location_point::geography,
            radius_km * 1000
        )
        AND (category_filter IS NULL OR b.categories && category_filter)
        AND (search_text IS NULL OR 
             b.name ILIKE '%' || search_text || '%' OR 
             b.description ILIKE '%' || search_text || '%')
    ORDER BY distance_km ASC, b.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 8: Create count function for pagination
CREATE OR REPLACE FUNCTION count_businesses_by_location(
    search_lat FLOAT,
    search_lng FLOAT,
    radius_km FLOAT DEFAULT 25,
    category_filter TEXT[] DEFAULT NULL,
    search_text TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM businesses b
        WHERE b.is_active = true
            AND b.location_point IS NOT NULL
            AND ST_DWithin(
                ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography,
                b.location_point::geography,
                radius_km * 1000
            )
            AND (category_filter IS NULL OR b.categories && category_filter)
            AND (search_text IS NULL OR 
                 b.name ILIKE '%' || search_text || '%' OR 
                 b.description ILIKE '%' || search_text || '%')
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 9: Create index on distance calculation for performance
CREATE INDEX CONCURRENTLY idx_businesses_distance_calc
ON businesses (created_at)
WHERE location_point IS NOT NULL AND is_active = true;

-- Step 10: Add constraints and validation
ALTER TABLE businesses 
ADD CONSTRAINT check_location_point_valid 
CHECK (location_point IS NULL OR ST_IsValid(location_point));

-- Performance optimization: Cluster table by spatial index (run during maintenance window)
-- CLUSTER businesses USING idx_businesses_location_gist;

-- Create statistics for query planner optimization
CREATE STATISTICS businesses_location_stats (dependencies) 
ON location_point, categories, is_active FROM businesses;

ANALYZE businesses;

COMMENT ON COLUMN businesses.location_point IS 'PostGIS geometry point for spatial queries (SRID 4326)';
COMMENT ON FUNCTION search_businesses_by_location IS 'Optimized location-based business search with sub-1s performance';
COMMENT ON INDEX idx_businesses_location_gist IS 'Spatial index for location-based queries';