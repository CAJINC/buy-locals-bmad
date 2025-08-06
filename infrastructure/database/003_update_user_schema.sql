-- Update users table to match story requirements with JSONB profile field
-- and consumer role instead of customer

-- Drop existing constraints that reference the old role values
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add profile JSONB column
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile JSONB NOT NULL DEFAULT '{}';

-- Add is_email_verified and last_login_at columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Migrate existing first_name and last_name to profile JSONB
UPDATE users 
SET profile = jsonb_build_object(
    'firstName', first_name,
    'lastName', last_name
)
WHERE profile = '{}';

-- Update role values from 'customer' to 'consumer'
UPDATE users SET role = 'consumer' WHERE role = 'customer';

-- Add new role constraint with consumer instead of customer
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('consumer', 'business_owner', 'admin'));

-- Drop old columns after data migration
ALTER TABLE users DROP COLUMN IF EXISTS first_name;
ALTER TABLE users DROP COLUMN IF EXISTS last_name;
ALTER TABLE users DROP COLUMN IF EXISTS email_verified;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(is_email_verified);
CREATE INDEX IF NOT EXISTS idx_users_profile_gin ON users USING gin(profile);