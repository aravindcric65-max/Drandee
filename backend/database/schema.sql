-- Media table for video uploads
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL UNIQUE,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  hashtags JSONB DEFAULT '[]',
  privacy VARCHAR(20) DEFAULT 'public' CHECK (privacy IN ('public', 'friends', 'private')),
  sound JSONB,
  cover JSONB,
  aspect_ratio VARCHAR(10) DEFAULT '9:16',
  duration INTEGER,
  file_size BIGINT,
  file_type VARCHAR(50),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'uploading', 'processing', 'published', 'failed', 'deleted')),
  processing_progress INTEGER DEFAULT 0,
  total_respects INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  save_count INTEGER DEFAULT 0,
  watch_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_media_user_id ON media(user_id);
CREATE INDEX IF NOT EXISTS idx_media_status ON media(status);
CREATE INDEX IF NOT EXISTS idx_media_privacy ON media(privacy);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON media(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_published_at ON media(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_hashtags ON media USING GIN (hashtags);

-- Media interactions table
CREATE TABLE IF NOT EXISTS media_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('respect', 'comment', 'share', 'save', 'watch')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(media_id, user_id, interaction_type)
);

-- Indexes for interactions
CREATE INDEX IF NOT EXISTS idx_interactions_media_id ON media_interactions(media_id);
CREATE INDEX IF NOT EXISTS idx_interactions_user_id ON media_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON media_interactions(interaction_type);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for comments
CREATE INDEX IF NOT EXISTS idx_comments_media_id ON comments(media_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);

-- Saved collections table
CREATE TABLE IF NOT EXISTS saved_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_private BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Saved media table
CREATE TABLE IF NOT EXISTS saved_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES saved_collections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(collection_id, media_id),
  UNIQUE(user_id, media_id)
);

-- Indexes for saved media
CREATE INDEX IF NOT EXISTS idx_saved_media_collection ON saved_media(collection_id);
CREATE INDEX IF NOT EXISTS idx_saved_media_user ON saved_media(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_media_media ON saved_media(media_id);

-- Audio library table (for royalty-free music)
CREATE TABLE IF NOT EXISTS audio_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL,
  audio_url TEXT NOT NULL,
  cover_url TEXT,
  duration INTEGER NOT NULL,
  category VARCHAR(50),
  license_type VARCHAR(50) NOT NULL,
  license_url TEXT,
  source_url TEXT,
  attribution_required BOOLEAN DEFAULT false,
  attribution_text TEXT,
  approved_for_platform BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for audio library
CREATE INDEX IF NOT EXISTS idx_audio_category ON audio_library(category);
CREATE INDEX IF NOT EXISTS idx_audio_approved ON audio_library(approved_for_platform);

-- Upload sessions table (for resumable uploads)
CREATE TABLE IF NOT EXISTS upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  media_id UUID REFERENCES media(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'completed', 'failed', 'cancelled')),
  progress INTEGER DEFAULT 0,
  chunks_uploaded JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for upload sessions
CREATE INDEX IF NOT EXISTS idx_upload_sessions_user ON upload_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_status ON upload_sessions(status);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_expires ON upload_sessions(expires_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_media_updated_at
  BEFORE UPDATE ON media
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_collections_updated_at
  BEFORE UPDATE ON saved_collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Sample data for audio library (royalty-free tracks)
INSERT INTO audio_library (title, artist, audio_url, cover_url, duration, category, license_type, approved_for_platform) VALUES
('Summer Vibes', 'DJ Cool', 'https://example.com/audio/1.mp3', '🎵', 165, 'Trending', 'CC0', true),
('Night Drive', 'Synthwave', 'https://example.com/audio/2.mp3', '🌙', 192, 'Trending', 'CC0', true),
('Chill Beats', 'Lo-fi Girl', 'https://example.com/audio/3.mp3', '🎧', 150, 'Lo-fi', 'CC0', true),
('Motivation', 'Power Music', 'https://example.com/audio/4.mp3', '💪', 180, 'Motivation', 'CC0', true),
('Romantic', 'Love Songs', 'https://example.com/audio/5.mp3', '❤️', 225, 'Love', 'CC0', true),
('Sad Melody', 'Emotional', 'https://example.com/audio/6.mp3', '😢', 175, 'Sad', 'CC0', true)
ON CONFLICT DO NOTHING;