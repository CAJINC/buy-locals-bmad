-- Enterprise Performance Optimization Indexes and Functions
-- Task 8: Performance and Caching Optimization
-- Created: 2024

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_businesses_location_gist_performance;
DROP INDEX IF EXISTS idx_businesses_categories_gin_performance;
DROP INDEX IF EXISTS idx_businesses_name_fulltext_performance;
DROP INDEX IF EXISTS idx_businesses_rating_performance;
DROP INDEX IF EXISTS idx_businesses_created_at_performance;
DROP INDEX IF EXISTS idx_businesses_composite_search_performance;

-- Enterprise-grade spatial index with enhanced clustering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_location_gist_performance 
ON businesses 
USING GIST (location_point) 
WHERE is_active = true AND location_point IS NOT NULL;

-- Optimize GIN index for category searches with improved configuration
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_categories_gin_performance 
ON businesses 
USING GIN (categories gin__int_ops) 
WHERE is_active = true AND array_length(categories, 1) > 0;

-- Full-text search index for name and description with performance tuning
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_name_fulltext_performance
ON businesses 
USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')))
WHERE is_active = true;

-- Performance index for rating-based sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_rating_performance
ON businesses (
  (SELECT AVG(rating) FROM reviews WHERE business_id = businesses.id)
) 
WHERE is_active = true;

-- Index for newest business sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_created_at_performance
ON businesses (created_at DESC) 
WHERE is_active = true;

-- Composite index for complex search queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_composite_search_performance
ON businesses (is_active, location_point, categories, created_at)
WHERE is_active = true AND location_point IS NOT NULL;

-- Enterprise performance statistics gathering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_performance_stats
ON businesses (id, location_point, categories, created_at)
WHERE is_active = true;

-- Advanced spatial clustering for performance optimization
CLUSTER businesses USING idx_businesses_location_gist_performance;

-- Update table statistics for query optimization
ANALYZE businesses;

-- Create optimized search function with performance enhancements
CREATE OR REPLACE FUNCTION search_businesses_by_location_optimized(
  search_lat FLOAT,
  search_lng FLOAT,
  search_radius FLOAT,
  search_categories TEXT[] DEFAULT NULL,
  search_query TEXT DEFAULT NULL,
  result_limit INTEGER DEFAULT 10,
  result_offset INTEGER DEFAULT 0,
  sort_by TEXT DEFAULT 'distance'
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  location JSONB,
  categories TEXT[],
  hours JSONB,
  contact JSONB,
  amenities TEXT[],
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  is_active BOOLEAN,
  location_point GEOMETRY,
  distance_km NUMERIC,
  avg_rating NUMERIC,
  review_count BIGINT,
  is_currently_open BOOLEAN
) AS $$
DECLARE
  search_point GEOMETRY;
  base_query TEXT;
  where_conditions TEXT[] := ARRAY[]::TEXT[];
  order_clause TEXT;
  final_query TEXT;
BEGIN
  -- Create search point with proper SRID
  search_point := ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326);
  
  -- Base query with performance optimizations
  base_query := '
    SELECT 
      b.id,
      b.name,
      b.description,
      b.location,
      b.categories,
      b.hours,
      b.contact,
      b.amenities,
      b.created_at,
      b.updated_at,
      b.is_active,
      b.location_point,
      ROUND(
        (ST_Distance(
          $1::geometry,
          b.location_point
        ) / 1000.0)::numeric, 3
      ) as distance_km,
      COALESCE(r.avg_rating, 4.0)::numeric(3,2) as avg_rating,
      COALESCE(r.review_count, 0) as review_count,
      CASE 
        WHEN b.hours IS NOT NULL THEN
          business_is_currently_open(b.hours)
        ELSE false
      END as is_currently_open
    FROM businesses b
    LEFT JOIN (
      SELECT 
        business_id,
        AVG(rating)::numeric(3,2) as avg_rating,
        COUNT(*)::bigint as review_count
      FROM reviews
      WHERE created_at > NOW() - INTERVAL ''1 year''
      GROUP BY business_id
    ) r ON b.id = r.business_id';

  -- Build WHERE conditions
  where_conditions := array_append(where_conditions, 'b.is_active = true');
  where_conditions := array_append(where_conditions, 'b.location_point IS NOT NULL');
  
  -- Spatial constraint with proper geography casting
  where_conditions := array_append(where_conditions, 
    format('ST_DWithin($1::geometry::geography, b.location_point::geography, %s)', 
           search_radius * 1000));

  -- Category filtering with optimized array operations
  IF search_categories IS NOT NULL AND array_length(search_categories, 1) > 0 THEN
    where_conditions := array_append(where_conditions, 
      'b.categories && $2::text[]');
  END IF;

  -- Full-text search optimization
  IF search_query IS NOT NULL AND trim(search_query) != '' THEN
    where_conditions := array_append(where_conditions, 
      'to_tsvector(''english'', b.name || '' '' || COALESCE(b.description, '''')) @@ plainto_tsquery(''english'', $3)');
  END IF;

  -- Build ORDER BY clause based on sort_by parameter
  CASE sort_by
    WHEN 'rating' THEN
      order_clause := 'ORDER BY r.avg_rating DESC NULLS LAST, distance_km ASC';
    WHEN 'newest' THEN
      order_clause := 'ORDER BY b.created_at DESC, distance_km ASC';
    WHEN 'popular' THEN
      order_clause := 'ORDER BY r.review_count DESC NULLS LAST, distance_km ASC';
    ELSE -- 'distance' or default
      order_clause := 'ORDER BY distance_km ASC';
  END CASE;

  -- Construct final query
  final_query := base_query || 
                 ' WHERE ' || array_to_string(where_conditions, ' AND ') ||
                 ' ' || order_clause ||
                 format(' LIMIT %s OFFSET %s', result_limit, result_offset);

  -- Execute query with proper parameter binding
  IF search_categories IS NOT NULL AND search_query IS NOT NULL THEN
    RETURN QUERY EXECUTE final_query 
      USING search_point, search_categories, search_query;
  ELSIF search_categories IS NOT NULL THEN
    RETURN QUERY EXECUTE final_query 
      USING search_point, search_categories;
  ELSIF search_query IS NOT NULL THEN
    RETURN QUERY EXECUTE final_query 
      USING search_point, search_query;
  ELSE
    RETURN QUERY EXECUTE final_query 
      USING search_point;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Optimized count function for pagination
CREATE OR REPLACE FUNCTION count_businesses_by_location_optimized(
  search_lat FLOAT,
  search_lng FLOAT,
  search_radius FLOAT,
  search_categories TEXT[] DEFAULT NULL,
  search_query TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  search_point GEOMETRY;
  count_result BIGINT;
  where_conditions TEXT[] := ARRAY[]::TEXT[];
  count_query TEXT;
BEGIN
  search_point := ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326);
  
  -- Build WHERE conditions (same as search function)
  where_conditions := array_append(where_conditions, 'is_active = true');
  where_conditions := array_append(where_conditions, 'location_point IS NOT NULL');
  where_conditions := array_append(where_conditions, 
    format('ST_DWithin($1::geometry::geography, location_point::geography, %s)', 
           search_radius * 1000));

  IF search_categories IS NOT NULL AND array_length(search_categories, 1) > 0 THEN
    where_conditions := array_append(where_conditions, 'categories && $2::text[]');
  END IF;

  IF search_query IS NOT NULL AND trim(search_query) != '' THEN
    where_conditions := array_append(where_conditions, 
      'to_tsvector(''english'', name || '' '' || COALESCE(description, '''')) @@ plainto_tsquery(''english'', $3)');
  END IF;

  count_query := 'SELECT COUNT(*) FROM businesses WHERE ' || 
                 array_to_string(where_conditions, ' AND ');

  -- Execute count query
  IF search_categories IS NOT NULL AND search_query IS NOT NULL THEN
    EXECUTE count_query INTO count_result USING search_point, search_categories, search_query;
  ELSIF search_categories IS NOT NULL THEN
    EXECUTE count_query INTO count_result USING search_point, search_categories;
  ELSIF search_query IS NOT NULL THEN
    EXECUTE count_query INTO count_result USING search_point, search_query;
  ELSE
    EXECUTE count_query INTO count_result USING search_point;
  END IF;

  RETURN count_result;
END;
$$ LANGUAGE plpgsql;

-- Business hours checking function
CREATE OR REPLACE FUNCTION business_is_currently_open(hours_json JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  current_day TEXT;
  current_time INTEGER;
  day_hours JSONB;
  open_time INTEGER;
  close_time INTEGER;
BEGIN
  -- Get current day and time
  current_day := lower(to_char(NOW(), 'Day'));
  current_day := trim(current_day);
  current_time := EXTRACT(hour FROM NOW()) * 100 + EXTRACT(minute FROM NOW());

  -- Map full day names to abbreviated ones
  CASE current_day
    WHEN 'monday' THEN current_day := 'mon';
    WHEN 'tuesday' THEN current_day := 'tue'; 
    WHEN 'wednesday' THEN current_day := 'wed';
    WHEN 'thursday' THEN current_day := 'thu';
    WHEN 'friday' THEN current_day := 'fri';
    WHEN 'saturday' THEN current_day := 'sat';
    WHEN 'sunday' THEN current_day := 'sun';
  END CASE;

  -- Get hours for current day
  day_hours := hours_json->current_day;
  
  IF day_hours IS NULL OR (day_hours->>'closed')::boolean = true THEN
    RETURN false;
  END IF;

  -- Parse open and close times
  open_time := CASE 
    WHEN day_hours->>'open' IS NOT NULL THEN
      (split_part(day_hours->>'open', ':', 1)::INTEGER * 100 + 
       split_part(day_hours->>'open', ':', 2)::INTEGER)
    ELSE 0
  END;
  
  close_time := CASE 
    WHEN day_hours->>'close' IS NOT NULL THEN
      (split_part(day_hours->>'close', ':', 1)::INTEGER * 100 + 
       split_part(day_hours->>'close', ':', 2)::INTEGER)
    ELSE 2359
  END;

  -- Handle overnight hours (e.g., 22:00 to 02:00)
  IF close_time < open_time THEN
    RETURN current_time >= open_time OR current_time <= close_time;
  ELSE
    RETURN current_time >= open_time AND current_time <= close_time;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Performance monitoring view
CREATE OR REPLACE VIEW search_performance_stats AS
SELECT 
  'database' as component,
  'query_performance' as metric_type,
  COUNT(*) as total_businesses,
  COUNT(CASE WHEN location_point IS NOT NULL THEN 1 END) as geo_enabled_businesses,
  AVG(array_length(categories, 1)) as avg_categories_per_business,
  (SELECT COUNT(*) FROM pg_stat_user_indexes WHERE relname = 'businesses') as index_count,
  pg_size_pretty(pg_total_relation_size('businesses')) as table_size,
  NOW() as measured_at
FROM businesses
WHERE is_active = true;

-- Grant permissions for performance monitoring
GRANT SELECT ON search_performance_stats TO PUBLIC;

-- Update function permissions
GRANT EXECUTE ON FUNCTION search_businesses_by_location_optimized TO PUBLIC;
GRANT EXECUTE ON FUNCTION count_businesses_by_location_optimized TO PUBLIC;
GRANT EXECUTE ON FUNCTION business_is_currently_open TO PUBLIC;

-- Analyze tables for optimal query planning
ANALYZE businesses;
ANALYZE reviews;

-- Comment for performance tracking
COMMENT ON FUNCTION search_businesses_by_location_optimized IS 
'Optimized location search function with enterprise performance enhancements - Target: <100ms execution time';