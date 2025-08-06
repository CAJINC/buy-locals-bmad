-- Development seed data for Buy Locals platform
-- Creates sample users, businesses, and test data for development

-- Insert test users (passwords are hashed for 'password123')
INSERT INTO users (id, email, password_hash, role, profile, is_email_verified) VALUES
(
    gen_random_uuid(),
    'consumer@example.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password123
    'consumer',
    '{"firstName": "John", "lastName": "Doe", "phone": "+1234567890", "locationPreferences": {"city": "San Francisco", "state": "CA"}}',
    true
),
(
    gen_random_uuid(),
    'business@example.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password123
    'business_owner',
    '{"firstName": "Jane", "lastName": "Smith", "phone": "+1234567891"}',
    true
),
(
    gen_random_uuid(),
    'admin@example.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password123
    'admin',
    '{"firstName": "Admin", "lastName": "User", "phone": "+1234567892"}',
    true
);

-- Insert test businesses
INSERT INTO businesses (id, owner_id, name, description, location, categories, hours, contact, media, services, is_active) VALUES
(
    gen_random_uuid(),
    (SELECT id FROM users WHERE email = 'business@example.com' LIMIT 1),
    'Local Coffee House',
    'Artisanal coffee and pastries in the heart of downtown',
    '{"address": "123 Main St, San Francisco, CA 94102", "coordinates": {"lat": 37.7749, "lng": -122.4194}, "city": "San Francisco", "state": "CA", "zipCode": "94102"}',
    ARRAY['coffee', 'restaurant', 'bakery'],
    '{"monday": {"open": "07:00", "close": "19:00"}, "tuesday": {"open": "07:00", "close": "19:00"}, "wednesday": {"open": "07:00", "close": "19:00"}, "thursday": {"open": "07:00", "close": "19:00"}, "friday": {"open": "07:00", "close": "20:00"}, "saturday": {"open": "08:00", "close": "20:00"}, "sunday": {"open": "08:00", "close": "18:00"}}',
    '{"phone": "+14155551234", "email": "info@localcoffeehouse.com", "website": "https://localcoffeehouse.com"}',
    '["https://example.com/coffee-interior.jpg", "https://example.com/coffee-menu.jpg"]',
    '[{"name": "Espresso", "description": "Rich, bold espresso shot", "price": 3.50, "duration": 5}, {"name": "Latte", "description": "Creamy espresso with steamed milk", "price": 4.75, "duration": 5}]',
    true
),
(
    gen_random_uuid(),
    (SELECT id FROM users WHERE email = 'business@example.com' LIMIT 1),
    'Downtown Barber Shop',
    'Traditional barbering services with modern style',
    '{"address": "456 Market St, San Francisco, CA 94105", "coordinates": {"lat": 37.7849, "lng": -122.4094}, "city": "San Francisco", "state": "CA", "zipCode": "94105"}',
    ARRAY['barber', 'grooming', 'services'],
    '{"monday": {"closed": true}, "tuesday": {"open": "09:00", "close": "18:00"}, "wednesday": {"open": "09:00", "close": "18:00"}, "thursday": {"open": "09:00", "close": "18:00"}, "friday": {"open": "09:00", "close": "19:00"}, "saturday": {"open": "08:00", "close": "17:00"}, "sunday": {"open": "10:00", "close": "16:00"}}',
    '{"phone": "+14155551235", "email": "contact@downtownbarber.com"}',
    '["https://example.com/barber-shop.jpg"]',
    '[{"name": "Haircut", "description": "Classic mens haircut", "price": 35.00, "duration": 30}, {"name": "Beard Trim", "description": "Professional beard trimming and styling", "price": 20.00, "duration": 15}]',
    true
);

-- Insert test bookings
INSERT INTO bookings (id, user_id, business_id, booking_date, start_time, end_time, service_details, party_size, status, total_amount, payment_status) VALUES
(
    gen_random_uuid(),
    (SELECT id FROM users WHERE email = 'consumer@example.com' LIMIT 1),
    (SELECT id FROM businesses WHERE name = 'Downtown Barber Shop' LIMIT 1),
    CURRENT_DATE + INTERVAL '1 day',
    '14:00:00',
    '14:30:00',
    '{"serviceName": "Haircut", "price": 35.00}',
    1,
    'confirmed',
    35.00,
    'paid'
);

-- Insert test reviews
INSERT INTO reviews (id, user_id, business_id, rating, title, comment, is_verified) VALUES
(
    gen_random_uuid(),
    (SELECT id FROM users WHERE email = 'consumer@example.com' LIMIT 1),
    (SELECT id FROM businesses WHERE name = 'Local Coffee House' LIMIT 1),
    5,
    'Amazing coffee!',
    'The best latte in the city. Friendly staff and cozy atmosphere.',
    true
);