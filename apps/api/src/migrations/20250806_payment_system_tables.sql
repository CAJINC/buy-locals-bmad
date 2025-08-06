-- Migration: Payment System Tables
-- Description: Create comprehensive payment system tables for Buy Locals platform
-- Date: 2025-08-06

BEGIN;

-- Payment Transactions Table
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
    business_id UUID NOT NULL REFERENCES businesses(id),
    user_id UUID NOT NULL REFERENCES users(id),
    reservation_id UUID REFERENCES reservations(id),
    service_id UUID,
    
    -- Transaction amounts (in cents)
    amount INTEGER NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    platform_fee INTEGER DEFAULT 0,
    business_payout INTEGER DEFAULT 0,
    captured_amount INTEGER,
    
    -- Transaction details
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    payment_method_id VARCHAR(255),
    escrow_enabled BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    captured_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    stripe_webhook_processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Additional fields
    description TEXT,
    failure_reason TEXT,
    cancellation_reason VARCHAR(100),
    capture_reason TEXT,
    metadata JSONB DEFAULT '{}',
    correlation_id VARCHAR(255),
    
    -- Indexes
    CONSTRAINT valid_status CHECK (status IN (
        'pending', 'requires_payment_method', 'requires_confirmation', 'requires_action',
        'processing', 'requires_capture', 'canceled', 'succeeded', 'failed', 'refunded'
    )),
    CONSTRAINT valid_currency CHECK (currency IN ('USD', 'CAD', 'EUR', 'GBP'))
);

-- Refunds Table
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    refund_id VARCHAR(255) UNIQUE NOT NULL, -- Stripe refund ID
    payment_intent_id VARCHAR(255) NOT NULL,
    business_id UUID NOT NULL REFERENCES businesses(id),
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Refund amounts (in cents)
    amount INTEGER NOT NULL CHECK (amount > 0),
    business_adjustment INTEGER DEFAULT 0,
    platform_fee_refund INTEGER DEFAULT 0,
    
    -- Refund details
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    reason TEXT,
    reason_code VARCHAR(100),
    initiated_by VARCHAR(20) NOT NULL CHECK (initiated_by IN ('customer', 'business', 'admin', 'system')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    stripe_webhook_processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Additional fields
    metadata JSONB DEFAULT '{}',
    correlation_id VARCHAR(255),
    
    CONSTRAINT valid_refund_status CHECK (status IN (
        'pending', 'processing', 'succeeded', 'failed', 'canceled'
    ))
);

-- Business Payouts Table
CREATE TABLE IF NOT EXISTS business_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    stripe_payout_id VARCHAR(255),
    
    -- Payout amounts (in cents)
    amount INTEGER NOT NULL CHECK (amount > 0),
    platform_fee INTEGER DEFAULT 0,
    net_amount INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    
    -- Payout details
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    payout_type VARCHAR(20) NOT NULL CHECK (payout_type IN ('manual', 'automatic')),
    description TEXT,
    
    -- Transaction references
    transaction_ids UUID[] DEFAULT '{}',
    transaction_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expected_payout_date TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    stripe_webhook_processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Additional fields
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}',
    correlation_id VARCHAR(255),
    
    CONSTRAINT valid_payout_status CHECK (status IN (
        'scheduled', 'processing', 'paid', 'failed', 'canceled'
    )),
    CONSTRAINT valid_currency CHECK (currency IN ('USD', 'CAD', 'EUR', 'GBP'))
);

-- Business Payout Adjustments Table
CREATE TABLE IF NOT EXISTS business_payout_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    payment_intent_id VARCHAR(255),
    refund_id VARCHAR(255),
    payout_id UUID REFERENCES business_payouts(id),
    
    -- Adjustment details
    adjustment_amount INTEGER NOT NULL, -- Can be negative
    adjustment_type VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    applied_at TIMESTAMP WITH TIME ZONE,
    
    -- Additional fields
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT valid_adjustment_type CHECK (adjustment_type IN (
        'refund_deduction', 'dispute_deduction', 'fee_adjustment', 'manual_adjustment', 'chargeback'
    ))
);

-- Tax Calculations Table
CREATE TABLE IF NOT EXISTS tax_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    user_id UUID NOT NULL REFERENCES users(id),
    payment_intent_id VARCHAR(255),
    
    -- Tax amounts (in cents)
    total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
    taxable_amount INTEGER NOT NULL CHECK (taxable_amount >= 0),
    tax_exempt_amount INTEGER DEFAULT 0,
    total_tax_amount INTEGER NOT NULL CHECK (total_tax_amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    
    -- Tax details
    transaction_type VARCHAR(20) NOT NULL DEFAULT 'sale',
    customer_address JSONB NOT NULL,
    business_address JSONB,
    tax_breakdown JSONB NOT NULL DEFAULT '[]',
    item_details JSONB NOT NULL DEFAULT '[]',
    
    -- Provider information
    tax_provider VARCHAR(50) NOT NULL,
    jurisdiction VARCHAR(100) NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Additional fields
    metadata JSONB DEFAULT '{}',
    correlation_id VARCHAR(255),
    
    CONSTRAINT valid_transaction_type CHECK (transaction_type IN ('sale', 'refund', 'adjustment')),
    CONSTRAINT valid_currency CHECK (currency IN ('USD', 'CAD', 'EUR', 'GBP'))
);

-- Tax Rate Lookups Table (for caching)
CREATE TABLE IF NOT EXISTS tax_rate_lookups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    business_id UUID REFERENCES businesses(id),
    
    -- Location details
    address JSONB NOT NULL,
    jurisdiction VARCHAR(100) NOT NULL,
    
    -- Tax rate information
    tax_rates JSONB NOT NULL DEFAULT '[]',
    combined_rate DECIMAL(8,6) NOT NULL,
    tax_category VARCHAR(100),
    
    -- Provider information
    tax_provider VARCHAR(50) NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    
    -- Additional fields
    correlation_id VARCHAR(255)
);

-- Payment Disputes Table
CREATE TABLE IF NOT EXISTS payment_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id VARCHAR(255) UNIQUE NOT NULL, -- Stripe dispute ID
    charge_id VARCHAR(255) NOT NULL,
    payment_intent_id VARCHAR(255),
    business_id UUID REFERENCES businesses(id),
    
    -- Dispute details
    amount INTEGER NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL,
    reason VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    
    -- Evidence and resolution
    evidence_due_by TIMESTAMP WITH TIME ZONE,
    evidence_submitted_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution VARCHAR(50),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Additional fields
    metadata JSONB DEFAULT '{}',
    correlation_id VARCHAR(255),
    
    CONSTRAINT valid_currency CHECK (currency IN ('USD', 'CAD', 'EUR', 'GBP'))
);

-- Webhook Events Table (for idempotency)
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    processed BOOLEAN DEFAULT false,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Additional fields
    correlation_id VARCHAR(255)
);

-- Payment Audit Logs Table
CREATE TABLE IF NOT EXISTS payment_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    
    -- Context information
    user_id VARCHAR(255),
    business_id UUID,
    ip_address INET,
    user_agent TEXT,
    
    -- Audit details
    success BOOLEAN NOT NULL DEFAULT true,
    error_code VARCHAR(100),
    error_message TEXT,
    
    -- Timestamps
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Additional fields
    correlation_id VARCHAR(255),
    metadata JSONB DEFAULT '{}'
);

-- Security Audit Logs Table
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation VARCHAR(100) NOT NULL,
    endpoint_name VARCHAR(200) NOT NULL,
    
    -- Security context
    user_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    
    -- Security result
    result VARCHAR(20) NOT NULL CHECK (result IN ('passed', 'blocked', 'error')),
    details JSONB DEFAULT '{}',
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Additional fields
    correlation_id VARCHAR(255)
);

-- Blocked IPs Table
CREATE TABLE IF NOT EXISTS blocked_ips (
    ip_address INET PRIMARY KEY,
    reason VARCHAR(200) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Additional fields
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_business_id ON payment_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_intent ON payment_transactions(payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_refunds_payment_intent_id ON refunds(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_refunds_business_id ON refunds(business_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON refunds(created_at);

CREATE INDEX IF NOT EXISTS idx_business_payouts_business_id ON business_payouts(business_id);
CREATE INDEX IF NOT EXISTS idx_business_payouts_status ON business_payouts(status);
CREATE INDEX IF NOT EXISTS idx_business_payouts_expected_date ON business_payouts(expected_payout_date);
CREATE INDEX IF NOT EXISTS idx_business_payouts_created_at ON business_payouts(created_at);

CREATE INDEX IF NOT EXISTS idx_tax_calculations_business_id ON tax_calculations(business_id);
CREATE INDEX IF NOT EXISTS idx_tax_calculations_created_at ON tax_calculations(created_at);

CREATE INDEX IF NOT EXISTS idx_payment_audit_logs_timestamp ON payment_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_payment_audit_logs_user_id ON payment_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_logs_operation ON payment_audit_logs(operation_type);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_at ON security_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_ip_address ON security_audit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_result ON security_audit_logs(result);

CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_id ON webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);

-- Add columns to existing tables if they don't exist
DO $$
BEGIN
    -- Add payment-related columns to businesses table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'stripe_account_id') THEN
        ALTER TABLE businesses ADD COLUMN stripe_account_id VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'tax_id') THEN
        ALTER TABLE businesses ADD COLUMN tax_id VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'tax_exempt') THEN
        ALTER TABLE businesses ADD COLUMN tax_exempt BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'payout_schedule') THEN
        ALTER TABLE businesses ADD COLUMN payout_schedule VARCHAR(20) DEFAULT 'weekly';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'minimum_payout_amount') THEN
        ALTER TABLE businesses ADD COLUMN minimum_payout_amount INTEGER DEFAULT 100; -- $1.00
    END IF;

    -- Add payment-related columns to users table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'stripe_customer_id') THEN
        ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255);
    END IF;

    -- Add payment-related columns to reservations table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'payment_intent_id') THEN
        ALTER TABLE reservations ADD COLUMN payment_intent_id VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'payment_status') THEN
        ALTER TABLE reservations ADD COLUMN payment_status VARCHAR(50) DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'payment_captured_at') THEN
        ALTER TABLE reservations ADD COLUMN payment_captured_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'refund_amount') THEN
        ALTER TABLE reservations ADD COLUMN refund_amount INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'completion_status') THEN
        ALTER TABLE reservations ADD COLUMN completion_status VARCHAR(50) DEFAULT 'pending';
    END IF;

EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error adding columns: %', SQLERRM;
END $$;

-- Create foreign key constraints
DO $$
BEGIN
    -- Add foreign key for payment_transactions -> payment_intent_id in refunds
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_refunds_payment_intent' AND table_name = 'refunds'
    ) THEN
        ALTER TABLE refunds ADD CONSTRAINT fk_refunds_payment_intent 
            FOREIGN KEY (payment_intent_id) REFERENCES payment_transactions(payment_intent_id);
    END IF;

    -- Add foreign key for reservations -> payment_intent_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_reservations_payment_intent' AND table_name = 'reservations'
    ) THEN
        ALTER TABLE reservations ADD CONSTRAINT fk_reservations_payment_intent 
            FOREIGN KEY (payment_intent_id) REFERENCES payment_transactions(payment_intent_id);
    END IF;

EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error adding foreign keys: %', SQLERRM;
END $$;

-- Create functions for automated tasks
CREATE OR REPLACE FUNCTION update_payment_transaction_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trg_payment_transactions_updated_at ON payment_transactions;
CREATE TRIGGER trg_payment_transactions_updated_at
    BEFORE UPDATE ON payment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_transaction_timestamp();

DROP TRIGGER IF EXISTS trg_refunds_updated_at ON refunds;
CREATE TRIGGER trg_refunds_updated_at
    BEFORE UPDATE ON refunds
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_transaction_timestamp();

DROP TRIGGER IF EXISTS trg_business_payouts_updated_at ON business_payouts;
CREATE TRIGGER trg_business_payouts_updated_at
    BEFORE UPDATE ON business_payouts
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_transaction_timestamp();

-- Create view for payment summary
CREATE OR REPLACE VIEW payment_summary AS
SELECT 
    b.id as business_id,
    b.name as business_name,
    COUNT(pt.id) as total_transactions,
    SUM(CASE WHEN pt.status = 'succeeded' THEN pt.amount ELSE 0 END) as total_revenue,
    SUM(CASE WHEN pt.status = 'succeeded' THEN pt.platform_fee ELSE 0 END) as total_platform_fees,
    SUM(CASE WHEN pt.status = 'succeeded' THEN pt.business_payout ELSE 0 END) as total_business_payout,
    COUNT(CASE WHEN pt.status = 'succeeded' THEN 1 END) as successful_transactions,
    COUNT(CASE WHEN pt.status = 'failed' THEN 1 END) as failed_transactions,
    COUNT(r.id) as total_refunds,
    COALESCE(SUM(r.amount), 0) as total_refunded,
    pt.currency
FROM businesses b
LEFT JOIN payment_transactions pt ON b.id = pt.business_id
LEFT JOIN refunds r ON pt.payment_intent_id = r.payment_intent_id AND r.status = 'succeeded'
GROUP BY b.id, b.name, pt.currency;

COMMIT;