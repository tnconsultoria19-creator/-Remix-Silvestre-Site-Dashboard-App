-- Migration: 0001_initial
-- Create tables for CRM and Ticketing Platform

-- USERS (Includes Agents/Admins)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'agent', -- 'agent', 'admin', 'superadmin', 'customer'
  avatar_url TEXT,
  whatsapp TEXT,
  country TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- COMPANIES
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT,
  website TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- CUSTOMERS (Clients belonging to Companies)
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- LEADS (CRM Pipeline)
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  value REAL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'New', -- 'New', 'Contacted', 'Qualified', 'Won', 'Lost'
  assigned_to TEXT,
  customer_id TEXT,
  contactPerson TEXT,
  socials TEXT,
  notes TEXT,
  customFields TEXT,
  uploads TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- TICKETS (Support/Helpdesk)
CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'Open', -- 'Open', 'In Progress', 'Resolved', 'Closed'
  priority TEXT DEFAULT 'Medium', -- 'Low', 'Medium', 'High', 'Urgent'
  customer_id TEXT,
  assigned_to TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id)
);

-- COMMENTS (For Tickets and Leads)
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL, -- 'ticket' or 'lead'
  entity_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- KV STORE emulation
CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Initial Superadmin Seed
INSERT OR IGNORE INTO users (id, email, name, password, role) 
VALUES ('usr_1', 'admin@example.com', 'Super Admin', 'admin123', 'superadmin');
