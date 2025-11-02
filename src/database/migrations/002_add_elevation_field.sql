-- Add elevation field to races table
-- This field stores elevation gain/loss information (e.g., "5400D+/3600D-")
-- Created: 2025-11-02

ALTER TABLE races ADD COLUMN elevation TEXT;
