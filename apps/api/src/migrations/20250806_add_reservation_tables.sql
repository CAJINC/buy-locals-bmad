-- Migration: Add reservation system tables
-- Date: 2025-08-06
-- Description: Add tables for enhanced reservation system with inventory tracking

-- Add reservations table to extend bookings
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('service', 'product', 'table', 'consultation', 'event')),
    items JSONB DEFAULT '[]',
    requirements JSONB DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE,
    modification_policy JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Product inventory tracking
CREATE TABLE IF NOT EXISTS product_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    product_id VARCHAR(255) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_description TEXT,
    unit_price DECIMAL(10,2) DEFAULT 0,
    total_quantity INTEGER NOT NULL DEFAULT 0,
    available_quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    minimum_stock INTEGER DEFAULT 0,
    is_tracking_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT positive_quantities CHECK (
        total_quantity >= 0 AND 
        available_quantity >= 0 AND 
        reserved_quantity >= 0 AND
        available_quantity + reserved_quantity <= total_quantity
    ),
    UNIQUE(business_id, product_id)
);

-- Inventory holds for reservations
CREATE TABLE IF NOT EXISTS inventory_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    product_id VARCHAR(255) NOT NULL,
    quantity_held INTEGER NOT NULL CHECK (quantity_held > 0),
    hold_until TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'confirmed', 'expired', 'released')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Service type configurations
CREATE TABLE IF NOT EXISTS service_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type_category VARCHAR(50) NOT NULL,
    form_config JSONB NOT NULL DEFAULT '{}',
    booking_rules JSONB NOT NULL DEFAULT '{}',
    pricing_config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(business_id, name)
);

-- Inventory adjustments log
CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id VARCHAR(255) NOT NULL,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    adjustment INTEGER NOT NULL,
    reason VARCHAR(500) NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    adjusted_by UUID, -- Could reference users table when available
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Reservation modifications log
CREATE TABLE IF NOT EXISTS reservation_modifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL, -- Customer or business user ID
    changes JSONB NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'applied')),
    fee_charged DECIMAL(10,2) DEFAULT 0,
    approved_by UUID, -- Business user ID
    applied_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reservations_type ON reservations(type);
CREATE INDEX IF NOT EXISTS idx_reservations_expires_at ON reservations(expires_at);

CREATE INDEX IF NOT EXISTS idx_product_inventory_business ON product_inventory(business_id);
CREATE INDEX IF NOT EXISTS idx_product_inventory_product ON product_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_product_inventory_low_stock ON product_inventory(business_id) 
WHERE available_quantity <= minimum_stock AND is_tracking_enabled = true;

CREATE INDEX IF NOT EXISTS idx_inventory_holds_reservation ON inventory_holds(reservation_id);
CREATE INDEX IF NOT EXISTS idx_inventory_holds_product ON inventory_holds(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_holds_status ON inventory_holds(status);
CREATE INDEX IF NOT EXISTS idx_inventory_holds_expiry ON inventory_holds(hold_until, status);

CREATE INDEX IF NOT EXISTS idx_service_types_business ON service_types(business_id);
CREATE INDEX IF NOT EXISTS idx_service_types_category ON service_types(type_category);

CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_product ON inventory_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_business ON inventory_adjustments(business_id);

CREATE INDEX IF NOT EXISTS idx_reservation_modifications_reservation ON reservation_modifications(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_modifications_status ON reservation_modifications(status);

-- Update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_inventory_updated_at BEFORE UPDATE ON product_inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_holds_updated_at BEFORE UPDATE ON inventory_holds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_service_types_updated_at BEFORE UPDATE ON service_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reservation_modifications_updated_at BEFORE UPDATE ON reservation_modifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();