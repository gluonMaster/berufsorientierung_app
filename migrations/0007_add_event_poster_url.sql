-- Migration: Add poster_url column to events table
-- Purpose: Store URL to event poster image in R2 storage

ALTER TABLE events ADD COLUMN poster_url TEXT;
