-- Add columns for adaptive polling feature
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS "lastDataHash" TEXT,
ADD COLUMN IF NOT EXISTS "apiSyncOffset" INTEGER DEFAULT 0;

