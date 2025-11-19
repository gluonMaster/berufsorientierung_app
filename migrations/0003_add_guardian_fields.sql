-- ============================================================================
-- Migration: Add Guardian Fields
-- Database: Cloudflare D1 (SQLite)
-- Version: 0003
-- Created: 2025-11-18
-- Description: Добавление полей для родителя/опекуна несовершеннолетних
-- ============================================================================

-- Добавляем поля для информации о родителе/опекуне
-- Эти поля обязательны только для несовершеннолетних пользователей (возраст < 18)
ALTER TABLE users ADD COLUMN guardian_first_name TEXT;
ALTER TABLE users ADD COLUMN guardian_last_name TEXT;
ALTER TABLE users ADD COLUMN guardian_phone TEXT;
ALTER TABLE users ADD COLUMN guardian_consent INTEGER DEFAULT 0; -- 0 = no, 1 = yes

-- Комментарий для будущих разработчиков:
-- guardian_consent должно быть 1 (true) для всех несовершеннолетних пользователей
-- Валидация этого правила выполняется на уровне приложения

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
