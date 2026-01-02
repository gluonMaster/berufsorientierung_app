-- Migration: Add reviews and public review links tables
-- Purpose: Enable users to submit reviews for events and support anonymous public link reviews

-- ==========================================
-- Table: review_public_links
-- Stores public link tokens for anonymous review submission
-- ==========================================
CREATE TABLE IF NOT EXISTS review_public_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Index for looking up links by event
CREATE INDEX IF NOT EXISTS idx_review_public_links_event_id ON review_public_links(event_id);

-- Index for cleaning up expired links
CREATE INDEX IF NOT EXISTS idx_review_public_links_expires_at ON review_public_links(expires_at);

-- ==========================================
-- Table: reviews
-- Stores user reviews for events
-- ==========================================
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    public_link_id INTEGER REFERENCES review_public_links(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
    comment TEXT NOT NULL,
    is_anonymous INTEGER NOT NULL DEFAULT 0 CHECK (is_anonymous IN (0, 1)),
    public_display_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    moderated_at TEXT,
    moderated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Unique constraint: one review per event per registered user
-- Note: SQLite allows multiple NULLs in unique constraints, so public link reviews are not blocked
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_event_user ON reviews(event_id, user_id);

-- Index for moderation queue and public listing
CREATE INDEX IF NOT EXISTS idx_reviews_status_created ON reviews(status, created_at);

-- Index for looking up reviews by event
CREATE INDEX IF NOT EXISTS idx_reviews_event_id ON reviews(event_id);
