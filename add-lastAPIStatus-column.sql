-- Add lastAPIStatus column to user_settings table
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS "lastAPIStatus" text DEFAULT 'success';

