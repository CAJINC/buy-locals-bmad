-- Insert sample users
INSERT INTO users (id, email, password_hash, first_name, last_name, role, email_verified) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'admin@buylocals.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewJgzGJqv/GcI6Gm', 'Admin', 'User', 'admin', true),
('550e8400-e29b-41d4-a716-446655440001', 'john.doe@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewJgzGJqv/GcI6Gm', 'John', 'Doe', 'customer', true),
('550e8400-e29b-41d4-a716-446655440002', 'jane.smith@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewJgzGJqv/GcI6Gm', 'Jane', 'Smith', 'business_owner', true),
('550e8400-e29b-41d4-a716-446655440003', 'mike.johnson@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewJgzGJqv/GcI6Gm', 'Mike', 'Johnson', 'business_owner', true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample businesses
INSERT INTO businesses (id, owner_id, name, description, category, address, city, state, zip_code, phone, email, website, latitude, longitude, is_verified) VALUES
('650e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440002', 'Janes Coffee Shop', 'Cozy local coffee shop serving artisan coffee and pastries', 'Food & Beverage', '123 Main St', 'San Francisco', 'CA', '94102', '(415) 555-0001', 'info@janescoffee.com', 'https://janescoffee.com', 37.7749, -122.4194, true),
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 'Mikes Auto Repair', 'Professional auto repair services with 20+ years experience', 'Automotive', '456 Oak Ave', 'San Francisco', 'CA', '94103', '(415) 555-0002', 'mike@mikesauto.com', 'https://mikesauto.com', 37.7849, -122.4094, true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample services
INSERT INTO services (id, business_id, name, description, duration_minutes, price) VALUES
('750e8400-e29b-41d4-a716-446655440000', '650e8400-e29b-41d4-a716-446655440000', 'Coffee & Pastry', 'Fresh coffee with choice of pastry', 30, 12.50),
('750e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440000', 'Business Meeting Package', 'Reserved table for business meetings with coffee service', 120, 45.00),
('750e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440001', 'Oil Change', 'Standard oil change service', 60, 35.00),
('750e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440001', 'Brake Inspection', 'Complete brake system inspection', 45, 50.00)
ON CONFLICT (id) DO NOTHING;

-- Insert sample business hours
INSERT INTO business_hours (id, business_id, day_of_week, open_time, close_time) VALUES
-- Jane's Coffee Shop (Monday-Friday 7AM-6PM, Saturday 8AM-5PM, Sunday closed)
('850e8400-e29b-41d4-a716-446655440000', '650e8400-e29b-41d4-a716-446655440000', 1, '07:00', '18:00'), -- Monday
('850e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440000', 2, '07:00', '18:00'), -- Tuesday
('850e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440000', 3, '07:00', '18:00'), -- Wednesday
('850e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440000', 4, '07:00', '18:00'), -- Thursday
('850e8400-e29b-41d4-a716-446655440004', '650e8400-e29b-41d4-a716-446655440000', 5, '07:00', '18:00'), -- Friday
('850e8400-e29b-41d4-a716-446655440005', '650e8400-e29b-41d4-a716-446655440000', 6, '08:00', '17:00'), -- Saturday
('850e8400-e29b-41d4-a716-446655440006', '650e8400-e29b-41d4-a716-446655440000', 0, NULL, NULL, true), -- Sunday (closed)
-- Mike's Auto Repair (Monday-Friday 8AM-6PM, Saturday 9AM-4PM, Sunday closed)
('850e8400-e29b-41d4-a716-446655440007', '650e8400-e29b-41d4-a716-446655440001', 1, '08:00', '18:00'), -- Monday
('850e8400-e29b-41d4-a716-446655440008', '650e8400-e29b-41d4-a716-446655440001', 2, '08:00', '18:00'), -- Tuesday
('850e8400-e29b-41d4-a716-446655440009', '650e8400-e29b-41d4-a716-446655440001', 3, '08:00', '18:00'), -- Wednesday
('850e8400-e29b-41d4-a716-446655440010', '650e8400-e29b-41d4-a716-446655440001', 4, '08:00', '18:00'), -- Thursday
('850e8400-e29b-41d4-a716-446655440011', '650e8400-e29b-41d4-a716-446655440001', 5, '08:00', '18:00'), -- Friday
('850e8400-e29b-41d4-a716-446655440012', '650e8400-e29b-41d4-a716-446655440001', 6, '09:00', '16:00'), -- Saturday
('850e8400-e29b-41d4-a716-446655440013', '650e8400-e29b-41d4-a716-446655440001', 0, NULL, NULL, true) -- Sunday (closed)
ON CONFLICT (id) DO NOTHING;