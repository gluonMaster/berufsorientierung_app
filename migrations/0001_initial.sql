-- ============================================================================
-- Berufsorientierung App - Initial Database Schema
-- Database: Cloudflare D1 (SQLite)
-- Version: 0001
-- Created: 2025-10-21
-- ============================================================================

-- ============================================================================
-- USERS TABLE
-- Stores registered users with personal data and preferences
-- GDPR Compliant: Contains consent flags and deletion tracking
-- ============================================================================
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    
    -- Personal information
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    birth_date TEXT NOT NULL, -- ISO format: YYYY-MM-DD
    
    -- Address
    address_street TEXT NOT NULL,
    address_number TEXT NOT NULL,
    address_zip TEXT NOT NULL,
    address_city TEXT NOT NULL,
    
    -- Contact information
    phone TEXT NOT NULL,
    whatsapp TEXT, -- Optional WhatsApp number
    telegram TEXT, -- Optional Telegram username/ID
    
    -- Consent and permissions (0 = no, 1 = yes)
    photo_video_consent INTEGER NOT NULL DEFAULT 0, -- Consent for photo/video at events
    parental_consent INTEGER NOT NULL DEFAULT 0, -- Required if age < 18
    
    -- Preferences and status
    preferred_language TEXT NOT NULL DEFAULT 'de', -- de/en/ru/uk
    is_blocked INTEGER NOT NULL DEFAULT 0, -- Block access if deletion pending
    
    -- Timestamps
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- EVENTS TABLE
-- Stores events with multilingual content (de/en/ru/uk)
-- Supports draft/active/cancelled statuses
-- ============================================================================
CREATE TABLE events (
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
    max_participants INTEGER NOT NULL,
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

-- ============================================================================
-- EVENT_ADDITIONAL_FIELDS TABLE
-- Dynamic custom fields for event registration forms
-- Supports text/select/checkbox/date/number field types
-- ============================================================================
CREATE TABLE event_additional_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    
    -- Field configuration
    field_key TEXT NOT NULL, -- Unique identifier for the field (e.g., 'dietary_preferences')
    field_type TEXT NOT NULL, -- text/select/checkbox/date/number
    field_options TEXT, -- JSON array of options for select type: ["Option 1", "Option 2"]
    required INTEGER DEFAULT 0, -- 0 = optional, 1 = required
    
    -- Multilingual labels
    label_de TEXT NOT NULL,
    label_en TEXT,
    label_ru TEXT,
    label_uk TEXT,
    
    -- Multilingual placeholders
    placeholder_de TEXT,
    placeholder_en TEXT,
    placeholder_ru TEXT,
    placeholder_uk TEXT,
    
    -- Ensure unique field keys per event
    UNIQUE(event_id, field_key)
);

-- ============================================================================
-- REGISTRATIONS TABLE
-- Stores user registrations for events
-- Tracks cancellations and stores additional field data as JSON
-- ============================================================================
CREATE TABLE registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    event_id INTEGER NOT NULL REFERENCES events(id),
    
    -- Additional data from event_additional_fields
    -- JSON format: {"field_key": "value", ...}
    additional_data TEXT,
    
    -- Registration tracking
    registered_at TEXT DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TEXT, -- NULL if active, timestamp if cancelled
    cancellation_reason TEXT,
    
    -- Prevent duplicate registrations
    UNIQUE(user_id, event_id)
);

-- ============================================================================
-- ADMINS TABLE
-- Stores admin user relationships
-- Tracks who granted admin rights and when
-- ============================================================================
CREATE TABLE admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
    created_by INTEGER REFERENCES users(id), -- Admin who granted these rights
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ACTIVITY_LOG TABLE
-- Audit log for all user actions
-- Used for security monitoring and GDPR compliance
-- ============================================================================
CREATE TABLE activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id), -- NULL for anonymous actions
    action_type TEXT NOT NULL, -- e.g., 'user_registered', 'event_registered', 'profile_updated'
    details TEXT, -- JSON with additional context
    ip_address TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- DELETED_USERS_ARCHIVE TABLE
-- GDPR-compliant minimal archive of deleted users
-- Stores only necessary data for reporting (first name, last name, dates)
-- ============================================================================
CREATE TABLE deleted_users_archive (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    registered_at TEXT NOT NULL,
    deleted_at TEXT NOT NULL,
    events_participated TEXT -- Comma-separated list of event IDs or titles
);

-- ============================================================================
-- PENDING_DELETIONS TABLE
-- Scheduled user deletions (when 28-day rule not yet satisfied)
-- Processed by Cloudflare Cron Trigger daily at 02:00
-- ============================================================================
CREATE TABLE pending_deletions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
    deletion_date TEXT NOT NULL, -- Date when deletion should be executed
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Users table indexes
CREATE INDEX idx_users_email ON users(email);

-- Events table indexes
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_events_created_by ON events(created_by);

-- Event additional fields indexes
CREATE INDEX idx_event_fields_event_id ON event_additional_fields(event_id);

-- Registrations table indexes
CREATE INDEX idx_registrations_user_id ON registrations(user_id);
CREATE INDEX idx_registrations_event_id ON registrations(event_id);
-- Composite index for finding active registrations for an event
CREATE INDEX idx_registrations_event_cancelled ON registrations(event_id, cancelled_at);

-- Activity log indexes
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_timestamp ON activity_log(timestamp);

-- Pending deletions indexes
CREATE INDEX idx_pending_deletions_date ON pending_deletions(deletion_date);

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
