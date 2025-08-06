-- Migration 007: Business Hours Enhancement for Story 2.4 Phase 1
-- Purpose: Add timezone support and special hours functionality
-- BMAD Implementation: Database foundation for real-time hours calculation

-- Add timezone field to businesses table
ALTER TABLE businesses 
ADD COLUMN timezone VARCHAR(50) DEFAULT 'America/New_York';

-- Create special_hours table for holiday/override management
CREATE TABLE special_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    open_time TIME,
    close_time TIME,
    is_closed BOOLEAN DEFAULT FALSE,
    reason VARCHAR(255),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one special hour entry per business per date
    UNIQUE(business_id, date)
);

-- Create temporary_closures table for extended closure periods
CREATE TABLE temporary_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR(255) NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Validate date range
    CHECK (end_date >= start_date)
);

-- Performance indexes for hours-based queries
CREATE INDEX idx_businesses_timezone ON businesses(timezone);
CREATE INDEX idx_special_hours_business_date ON special_hours(business_id, date);
CREATE INDEX idx_special_hours_date_range ON special_hours(date) WHERE is_closed = false;
CREATE INDEX idx_temporary_closures_business ON temporary_closures(business_id);
CREATE INDEX idx_temporary_closures_date_range ON temporary_closures(start_date, end_date);

-- Business hours calculation function for real-time status
CREATE OR REPLACE FUNCTION calculate_business_status(
    business_id_param UUID,
    current_timestamp_param TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS TABLE (
    is_open BOOLEAN,
    status TEXT,
    reason TEXT,
    next_change TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    business_record RECORD;
    current_day TEXT;
    current_time TIME;
    day_hours JSONB;
    special_hour RECORD;
    temp_closure RECORD;
    business_time TIMESTAMP;
BEGIN
    -- Get business information
    SELECT * INTO business_record
    FROM businesses 
    WHERE id = business_id_param AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'unknown'::TEXT, 'Business not found'::TEXT, NULL::TIMESTAMP WITH TIME ZONE;
        RETURN;
    END IF;
    
    -- Convert current time to business timezone
    business_time := current_timestamp_param AT TIME ZONE business_record.timezone;
    current_day := LOWER(TO_CHAR(business_time, 'Day'));
    current_time := business_time::TIME;
    
    -- Remove trailing spaces from day name
    current_day := TRIM(current_day);
    
    -- Check for temporary closures
    SELECT * INTO temp_closure
    FROM temporary_closures tc
    WHERE tc.business_id = business_id_param
      AND business_time::DATE BETWEEN tc.start_date AND tc.end_date;
    
    IF FOUND THEN
        RETURN QUERY SELECT false, 'closed'::TEXT, temp_closure.reason, NULL::TIMESTAMP WITH TIME ZONE;
        RETURN;
    END IF;
    
    -- Check for special hours
    SELECT * INTO special_hour
    FROM special_hours sh
    WHERE sh.business_id = business_id_param
      AND sh.date = business_time::DATE;
    
    IF FOUND THEN
        IF special_hour.is_closed THEN
            RETURN QUERY SELECT false, 'closed'::TEXT, special_hour.reason, NULL::TIMESTAMP WITH TIME ZONE;
            RETURN;
        ELSE
            -- Check if currently within special hours
            IF current_time BETWEEN special_hour.open_time AND special_hour.close_time THEN
                RETURN QUERY SELECT true, 'open'::TEXT, special_hour.reason, 
                    (business_time::DATE + special_hour.close_time)::TIMESTAMP WITH TIME ZONE;
                RETURN;
            ELSE
                RETURN QUERY SELECT false, 'closed'::TEXT, special_hour.reason, 
                    (business_time::DATE + special_hour.open_time)::TIMESTAMP WITH TIME ZONE;
                RETURN;
            END IF;
        END IF;
    END IF;
    
    -- Check regular hours
    day_hours := business_record.hours -> current_day;
    
    IF day_hours IS NULL OR (day_hours->>'closed')::BOOLEAN = true THEN
        RETURN QUERY SELECT false, 'closed'::TEXT, 'Closed today'::TEXT, NULL::TIMESTAMP WITH TIME ZONE;
        RETURN;
    END IF;
    
    -- Parse open/close times
    DECLARE
        open_time TIME := (day_hours->>'open')::TIME;
        close_time TIME := (day_hours->>'close')::TIME;
    BEGIN
        -- Handle overnight businesses (close time next day)
        IF close_time < open_time THEN
            IF current_time >= open_time OR current_time < close_time THEN
                RETURN QUERY SELECT true, 'open'::TEXT, 'Regular hours'::TEXT,
                    CASE 
                        WHEN current_time >= open_time THEN (business_time::DATE + INTERVAL '1 day' + close_time)::TIMESTAMP WITH TIME ZONE
                        ELSE (business_time::DATE + close_time)::TIMESTAMP WITH TIME ZONE
                    END;
                RETURN;
            END IF;
        ELSE
            -- Regular same-day hours
            IF current_time BETWEEN open_time AND close_time THEN
                RETURN QUERY SELECT true, 'open'::TEXT, 'Regular hours'::TEXT,
                    (business_time::DATE + close_time)::TIMESTAMP WITH TIME ZONE;
                RETURN;
            END IF;
        END IF;
        
        RETURN QUERY SELECT false, 'closed'::TEXT, 'Outside business hours'::TEXT,
            (business_time::DATE + open_time)::TIMESTAMP WITH TIME ZONE;
        RETURN;
    END;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get businesses that are currently open
CREATE OR REPLACE FUNCTION get_open_businesses(
    latitude FLOAT DEFAULT NULL,
    longitude FLOAT DEFAULT NULL,
    radius_km FLOAT DEFAULT 25,
    category_filter TEXT[] DEFAULT NULL,
    search_term TEXT DEFAULT NULL,
    result_limit INTEGER DEFAULT 50
) RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    description TEXT,
    location JSONB,
    categories TEXT[],
    hours JSONB,
    contact JSONB,
    timezone VARCHAR(50),
    is_active BOOLEAN,
    distance_km FLOAT,
    is_open BOOLEAN,
    status TEXT,
    next_change TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    WITH business_status AS (
        SELECT 
            b.*,
            CASE 
                WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN
                    ST_Distance(
                        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
                        b.location_point::geography
                    ) / 1000.0
                ELSE 0
            END as distance_km,
            bs.is_open,
            bs.status,
            bs.next_change
        FROM businesses b
        CROSS JOIN LATERAL calculate_business_status(b.id) bs
        WHERE b.is_active = true
          AND (latitude IS NULL OR longitude IS NULL OR 
               ST_DWithin(
                   ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
                   b.location_point::geography,
                   radius_km * 1000
               ))
          AND (category_filter IS NULL OR b.categories && category_filter)
          AND (search_term IS NULL OR 
               b.name ILIKE '%' || search_term || '%' OR 
               b.description ILIKE '%' || search_term || '%')
    )
    SELECT 
        bs.id,
        bs.name,
        bs.description,
        bs.location,
        bs.categories,
        bs.hours,
        bs.contact,
        bs.timezone,
        bs.is_active,
        bs.distance_km,
        bs.is_open,
        bs.status,
        bs.next_change
    FROM business_status bs
    WHERE bs.is_open = true
    ORDER BY 
        CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL 
             THEN bs.distance_km 
             ELSE bs.name 
        END
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Update triggers for special_hours and temporary_closures
CREATE TRIGGER update_special_hours_updated_at 
    BEFORE UPDATE ON special_hours
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_temporary_closures_updated_at 
    BEFORE UPDATE ON temporary_closures
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Populate timezone field for existing businesses (US Eastern as default)
UPDATE businesses 
SET timezone = CASE 
    WHEN location->>'state' IN ('NY', 'NJ', 'CT', 'MA', 'RI', 'VT', 'NH', 'ME', 'PA', 'DE', 'MD', 'DC', 'VA', 'WV', 'NC', 'SC', 'GA', 'FL', 'OH', 'MI', 'IN', 'KY', 'TN') 
         THEN 'America/New_York'
    WHEN location->>'state' IN ('IL', 'WI', 'MN', 'IA', 'MO', 'AR', 'LA', 'MS', 'AL', 'ND', 'SD', 'NE', 'KS', 'OK', 'TX') 
         THEN 'America/Chicago'
    WHEN location->>'state' IN ('MT', 'WY', 'CO', 'NM', 'UT', 'ID', 'AZ') 
         THEN 'America/Denver'
    WHEN location->>'state' IN ('WA', 'OR', 'CA', 'NV') 
         THEN 'America/Los_Angeles'
    WHEN location->>'state' = 'AK' 
         THEN 'America/Anchorage'
    WHEN location->>'state' = 'HI' 
         THEN 'Pacific/Honolulu'
    ELSE 'America/New_York'
END
WHERE timezone = 'America/New_York';

-- Create index for timezone-based queries
CREATE INDEX idx_businesses_hours_timezone_composite ON businesses(timezone, is_active) 
WHERE is_active = true;

COMMIT;
