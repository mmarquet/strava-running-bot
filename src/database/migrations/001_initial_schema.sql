-- Initial schema creation for native SQLite
-- Members table
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  athlete_id INTEGER UNIQUE NOT NULL,
  discord_id TEXT UNIQUE NOT NULL,
  is_active INTEGER DEFAULT 1,
  athlete TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS member_athlete_idx ON members(athlete_id);
CREATE INDEX IF NOT EXISTS member_discord_idx ON members(discord_id);

-- Races table with enhanced fields
CREATE TABLE IF NOT EXISTS races (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_athlete_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  race_date TEXT NOT NULL,
  race_type TEXT NOT NULL DEFAULT 'road',
  distance TEXT,
  distance_km TEXT,
  location TEXT,
  status TEXT DEFAULT 'registered',
  notes TEXT,
  goal_time TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_athlete_id) REFERENCES members(athlete_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS race_member_idx ON races(member_athlete_id);
CREATE INDEX IF NOT EXISTS race_date_idx ON races(race_date);
CREATE INDEX IF NOT EXISTS race_type_idx ON races(race_type);