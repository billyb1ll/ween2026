-- Insert default values for hype board and featured photos into system_config

INSERT INTO system_config (key, value, text_value)
VALUES 
  ('enable_hype_board', true, null),
  ('featured_photo_urls', true, '[]')
ON CONFLICT (key) DO NOTHING;
