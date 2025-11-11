-- ============================================================================
-- Migration 0002: Make max_participants nullable
-- Date: 2025
-- Description: Allow NULL values in max_participants to support unlimited events
-- ============================================================================

-- SQLite doesn't support ALTER COLUMN directly, so we need to:
-- 1. Create a new table with the updated schema
-- 2. Copy data from the old table
-- 3. Drop the old table
-- 4. Rename the new table

-- Create new events table with nullable max_participants
CREATE TABLE events_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Multilingual title (German is required, others optional)
    title_de TEXT NOT NULL,
    title_en TEXT,
    title_ru TEXT,
    title_uk TEXT,
    
    -- Multilingual description
    description_de TEXT,
    description_en TEXT,
    description_ru TEXT,
    description_uk TEXT,
    
    -- Multilingual requirements
    requirements_de TEXT,
    requirements_en TEXT,
    requirements_ru TEXT,
    requirements_uk TEXT,
    
    -- Multilingual location (venue/address)
    location_de TEXT,
    location_en TEXT,
    location_ru TEXT,
    location_uk TEXT,
    
    -- Event details
    date TEXT NOT NULL, -- ISO format: YYYY-MM-DDTHH:MM:SS
    max_participants INTEGER, -- NULL = unlimited participants
    registration_deadline TEXT NOT NULL, -- ISO format: YYYY-MM-DDTHH:MM:SS
    
    -- Communication channels
    telegram_link TEXT, -- Telegram group/channel link
    whatsapp_link TEXT, -- WhatsApp group link
    qr_telegram_url TEXT, -- URL to QR code in R2 storage
    qr_whatsapp_url TEXT, -- URL to QR code in R2 storage
    
    -- Status management
    status TEXT DEFAULT 'draft', -- draft/active/cancelled
    cancelled_at TEXT,
    cancellation_reason TEXT,
    
    -- Metadata
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) -- Admin who created the event
);

-- Copy data from old table to new table
INSERT INTO events_new (
    id, title_de, title_en, title_ru, title_uk,
    description_de, description_en, description_ru, description_uk,
    requirements_de, requirements_en, requirements_ru, requirements_uk,
    location_de, location_en, location_ru, location_uk,
    date, max_participants, registration_deadline,
    telegram_link, whatsapp_link, qr_telegram_url, qr_whatsapp_url,
    status, cancelled_at, cancellation_reason,
    created_at, updated_at, created_by
)
SELECT 
    id, title_de, title_en, title_ru, title_uk,
    description_de, description_en, description_ru, description_uk,
    requirements_de, requirements_en, requirements_ru, requirements_uk,
    location_de, location_en, location_ru, location_uk,
    date, max_participants, registration_deadline,
    telegram_link, whatsapp_link, qr_telegram_url, qr_whatsapp_url,
    status, cancelled_at, cancellation_reason,
    created_at, updated_at, created_by
FROM events;

-- Drop old table
DROP TABLE events;

-- Rename new table to original name
ALTER TABLE events_new RENAME TO events;

-- Recreate indexes
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_events_created_by ON events(created_by);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
