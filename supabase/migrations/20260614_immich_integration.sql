-- Append an optional metadata text descriptor attribute column named immich_asset_id to users profile table
ALTER TABLE users ADD COLUMN IF NOT EXISTS immich_asset_id VARCHAR;
