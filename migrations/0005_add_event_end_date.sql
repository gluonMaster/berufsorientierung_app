-- Migration: Add end_date column to events
-- Purpose: Store event end time for reviews feature
-- The column is nullable to preserve backwards compatibility with existing events

ALTER TABLE events ADD COLUMN end_date TEXT;
