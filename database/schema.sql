-- ===============================
-- Smart Canteen Management System
-- Database Schema
-- ===============================

-- Users (Students / Staff)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15),
    wallet_balance DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Canteens (Multi-canteen support)
CREATE TABLE canteens (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    location VARCHAR(100),
    workload_capacity INT DEFAULT 50,
    current_workload INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

-- Menu items
CREATE TABLE menu_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    price DECIMAL(8,2) NOT NULL,
    prep_time_min INT DEFAULT 10,
    stock_available INT DEFAULT 100,
    canteen_id INT REFERENCES canteens(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(20) UNIQUE NOT NULL,
    user_id INT REFERENCES users(id),
    canteen_id INT REFERENCES canteens(id),
    items JSONB NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_mode VARCHAR(20),
    payment_status VARCHAR(20) DEFAULT 'success',
    status VARCHAR(20) DEFAULT 'placed',
    estimated_wait_time INT,
    prep_time_predicted INT,
    crowd_level VARCHAR(20),
    queue_length INT,
    meal_slot VARCHAR(20),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP
);

-- Machine Learning Predictions
CREATE TABLE ml_predictions (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(20) REFERENCES orders(order_id) ON DELETE CASCADE,
    prep_time_actual INT,
    prep_time_predicted INT,
    demand_predicted INT,
    wastage_estimated DECIMAL(8,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crowd detection data (YOLO output)
CREATE TABLE crowd_data (
    id SERIAL PRIMARY KEY,
    canteen_id INT REFERENCES canteens(id) ON DELETE CASCADE,
    people_count INT,
    queue_length INT,
    crowd_level VARCHAR(20),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================
-- SAMPLE DATA (Optional but useful)
-- ===============================

INSERT INTO canteens (name, location)
VALUES
('Main Canteen', 'Academic Block'),
('Engineering Canteen', 'Engineering Block'),
('Hostel Canteen', 'Hostel Area');

INSERT INTO menu_items (name, category, price, prep_time_min, stock_available, canteen_id)
VALUES
('Veg Biryani', 'Rice', 85.00, 15, 30, 1),
('Chicken Biryani', 'Rice', 110.00, 18, 25, 1),
('Masala Dosa', 'South Indian', 70.00, 10, 40, 2),
('Paneer Tikka', 'Starter', 95.00, 12, 20, 2),
('Cold Coffee', 'Beverage', 45.00, 3, 50, 3);
