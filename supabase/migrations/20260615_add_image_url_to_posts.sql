-- Add image_url column for memory board image attachments
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url TEXT;
