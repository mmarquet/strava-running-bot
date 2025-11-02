-- Complete initial schema for Strava Running Bot
-- This includes all tables, indexes, and initial configuration
-- Created: 2025-09-12

-- Members table with complete schema including Discord user data and encrypted tokens
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  athlete_id INTEGER UNIQUE NOT NULL,
  discord_id TEXT UNIQUE NOT NULL,
  discord_user_id TEXT, -- For compatibility with existing code
  is_active INTEGER DEFAULT 1,
  athlete TEXT, -- JSON string of athlete data
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  registered_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  -- Discord user information (essential for proper name display)
  discord_username TEXT,
  discord_display_name TEXT,
  discord_discriminator TEXT DEFAULT '0',
  discord_avatar TEXT,
  
  -- Encrypted token storage (stored as complete encrypted JSON object)
  encrypted_tokens TEXT -- JSON string containing the full encrypted token structure
);

-- Members table indexes
CREATE INDEX IF NOT EXISTS member_athlete_idx ON members(athlete_id);
CREATE INDEX IF NOT EXISTS member_discord_idx ON members(discord_id);
CREATE INDEX IF NOT EXISTS member_discord_username_idx ON members(discord_username);
CREATE INDEX IF NOT EXISTS member_discord_display_name_idx ON members(discord_display_name);
CREATE INDEX IF NOT EXISTS member_registered_at_idx ON members(registered_at);

-- Races table with enhanced fields for road/trail race tracking
CREATE TABLE IF NOT EXISTS races (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_athlete_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  race_date TEXT NOT NULL, -- ISO date string
  race_type TEXT NOT NULL DEFAULT 'road', -- 'road' or 'trail'
  distance TEXT, -- e.g. "42.2km", "10mi", "5K"
  distance_km TEXT, -- Standardized distance in km for sorting/filtering
  location TEXT,
  status TEXT DEFAULT 'registered', -- registered, completed, cancelled, dns, dnf
  notes TEXT,
  goal_time TEXT, -- e.g. "3:30:00"
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_athlete_id) REFERENCES members(athlete_id) ON DELETE CASCADE
);

-- Races table indexes
CREATE INDEX IF NOT EXISTS race_member_idx ON races(member_athlete_id);
CREATE INDEX IF NOT EXISTS race_date_idx ON races(race_date);
CREATE INDEX IF NOT EXISTS race_type_idx ON races(race_type);

-- Settings table for bot configuration that can be changed via commands
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Migration log table to track migration status and provide rollback data
CREATE TABLE IF NOT EXISTS migration_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  migration_name TEXT NOT NULL UNIQUE,
  executed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  success INTEGER NOT NULL,
  error_message TEXT,
  data_backup TEXT -- JSON backup of migrated data
);

-- Insert default bot settings
INSERT OR REPLACE INTO settings (key, value, description) VALUES 
('discord_channel_id', '', 'Default Discord channel for bot notifications'),
('strava_webhook_enabled', '1', 'Enable Strava webhook processing'),
('activity_processing_enabled', '1', 'Enable automatic activity processing'),
('debug_mode', '0', 'Enable debug logging');