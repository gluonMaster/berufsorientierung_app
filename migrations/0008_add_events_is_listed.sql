-- Migration: Add is_listed flag to events table
-- This flag controls visibility on the /events listing page
-- Direct links to /events/{id}/register remain accessible regardless of this flag

-- Add is_listed column (default 1 = visible in listing)
ALTER TABLE events ADD COLUMN is_listed INTEGER NOT NULL DEFAULT 1;

-- Index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_events_is_listed ON events(is_listed);
