-- Rollback PostGIS Location Migration for Story 2.2
-- Safe rollback strategy that preserves original JSONB location data

-- Step 1: Drop triggers first
DROP TRIGGER IF EXISTS businesses_location_point_trigger ON businesses;

-- Step 2: Drop functions
DROP FUNCTION IF EXISTS update_location_point();
DROP FUNCTION IF EXISTS search_businesses_by_location(FLOAT, FLOAT, FLOAT, TEXT[], TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS count_businesses_by_location(FLOAT, FLOAT, FLOAT, TEXT[], TEXT);
DROP FUNCTION IF EXISTS extract_coordinates_from_location(JSONB);

-- Step 3: Drop statistics
DROP STATISTICS IF EXISTS businesses_location_stats;

-- Step 4: Drop indexes (CONCURRENTLY for zero downtime)
DROP INDEX CONCURRENTLY IF EXISTS idx_businesses_location_gist;
DROP INDEX CONCURRENTLY IF EXISTS idx_businesses_location_categories;
DROP INDEX CONCURRENTLY IF EXISTS idx_businesses_location_active_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_businesses_distance_calc;

-- Step 5: Drop constraints
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS check_location_point_valid;

-- Step 6: Drop geometry column (this does not affect the original JSONB location data)
ALTER TABLE businesses DROP COLUMN IF EXISTS location_point;

-- Step 7: Verify original location data is intact
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'location'
    ) THEN
        RAISE EXCEPTION 'Original location JSONB column missing - rollback incomplete!';
    END IF;
    
    RAISE NOTICE 'Rollback completed successfully. Original JSONB location data preserved.';
END $$;

COMMENT ON TABLE businesses IS 'Rollback completed - using original JSONB location format';