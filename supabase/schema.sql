-- ==============================================
-- えるそれ！（L-Sore）テーブル作成SQL
-- プレフィックス: lsore_
-- 他ゲームのテーブルと同居可能
-- ==============================================

-- Roomsテーブル
CREATE TABLE IF NOT EXISTS public.lsore_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  password TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Playersテーブル
CREATE TABLE IF NOT EXISTS public.lsore_players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.lsore_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('dealer', 'player')),
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Game Stateテーブル
CREATE TABLE IF NOT EXISTS public.lsore_game_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.lsore_rooms(id) ON DELETE CASCADE,
  current_topic TEXT,
  phase TEXT NOT NULL DEFAULT 'lobby' CHECK (phase IN ('lobby', 'waiting', 'topic_drawn', 'answering', 'voting', 'results')),
  round INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(room_id)
);

-- Answersテーブル
CREATE TABLE IF NOT EXISTS public.lsore_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.lsore_rooms(id) ON DELETE CASCADE,
  game_state_id UUID NOT NULL REFERENCES public.lsore_game_state(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  votes INTEGER DEFAULT 0 NOT NULL,
  is_revealed BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Votesテーブル
CREATE TABLE IF NOT EXISTS public.lsore_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.lsore_rooms(id) ON DELETE CASCADE,
  answer_id UUID NOT NULL REFERENCES public.lsore_answers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(answer_id, user_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_lsore_players_room_id ON public.lsore_players(room_id);
CREATE INDEX IF NOT EXISTS idx_lsore_players_user_id ON public.lsore_players(user_id);
CREATE INDEX IF NOT EXISTS idx_lsore_game_state_room_id ON public.lsore_game_state(room_id);
CREATE INDEX IF NOT EXISTS idx_lsore_answers_room_id ON public.lsore_answers(room_id);
CREATE INDEX IF NOT EXISTS idx_lsore_answers_game_state_id ON public.lsore_answers(game_state_id);
CREATE INDEX IF NOT EXISTS idx_lsore_votes_room_id ON public.lsore_votes(room_id);
CREATE INDEX IF NOT EXISTS idx_lsore_votes_answer_id ON public.lsore_votes(answer_id);

-- Realtimeを有効化（既に追加済みの場合はスキップ）
DO $$
BEGIN
  -- lsore_players
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'lsore_players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lsore_players;
  END IF;
  
  -- lsore_game_state
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'lsore_game_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lsore_game_state;
  END IF;
  
  -- lsore_answers
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'lsore_answers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lsore_answers;
  END IF;
  
  -- lsore_votes
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'lsore_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lsore_votes;
  END IF;
END $$;

-- ==============================================
-- RLSポリシー設定
-- ==============================================

-- Roomsテーブル
ALTER TABLE public.lsore_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lsore_rooms_select" ON public.lsore_rooms;
CREATE POLICY "lsore_rooms_select" ON public.lsore_rooms
  FOR SELECT USING (true);

-- Playersテーブル
ALTER TABLE public.lsore_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lsore_players_select" ON public.lsore_players;
CREATE POLICY "lsore_players_select" ON public.lsore_players
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "lsore_players_insert" ON public.lsore_players;
CREATE POLICY "lsore_players_insert" ON public.lsore_players
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "lsore_players_update" ON public.lsore_players;
CREATE POLICY "lsore_players_update" ON public.lsore_players
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "lsore_players_delete" ON public.lsore_players;
CREATE POLICY "lsore_players_delete" ON public.lsore_players
  FOR DELETE USING (true);

-- Game Stateテーブル
ALTER TABLE public.lsore_game_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lsore_game_state_select" ON public.lsore_game_state;
CREATE POLICY "lsore_game_state_select" ON public.lsore_game_state
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "lsore_game_state_update" ON public.lsore_game_state;
CREATE POLICY "lsore_game_state_update" ON public.lsore_game_state
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "lsore_game_state_insert" ON public.lsore_game_state;
CREATE POLICY "lsore_game_state_insert" ON public.lsore_game_state
  FOR INSERT WITH CHECK (true);

-- Answersテーブル
ALTER TABLE public.lsore_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lsore_answers_select" ON public.lsore_answers;
CREATE POLICY "lsore_answers_select" ON public.lsore_answers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "lsore_answers_insert" ON public.lsore_answers;
CREATE POLICY "lsore_answers_insert" ON public.lsore_answers
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "lsore_answers_update" ON public.lsore_answers;
CREATE POLICY "lsore_answers_update" ON public.lsore_answers
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "lsore_answers_delete" ON public.lsore_answers;
CREATE POLICY "lsore_answers_delete" ON public.lsore_answers
  FOR DELETE USING (true);

-- Votesテーブル
ALTER TABLE public.lsore_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lsore_votes_select" ON public.lsore_votes;
CREATE POLICY "lsore_votes_select" ON public.lsore_votes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "lsore_votes_insert" ON public.lsore_votes;
CREATE POLICY "lsore_votes_insert" ON public.lsore_votes
  FOR INSERT WITH CHECK (true);

-- ==============================================
-- 初期データ投入（サンプルルーム）
-- ==============================================
INSERT INTO public.lsore_rooms (name, password) VALUES
  ('テストルーム1', 'test1'),
  ('テストルーム2', 'test2'),
  ('テストルーム3', 'test3')
ON CONFLICT (password) DO NOTHING;

-- ==============================================
-- GRANT権限（anonロールでのアクセス許可）
-- ==============================================

-- スキーマへのアクセス権限
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Roomsテーブル
GRANT SELECT ON public.lsore_rooms TO anon, authenticated;

-- Playersテーブル
GRANT ALL ON public.lsore_players TO anon, authenticated;

-- Game Stateテーブル
GRANT ALL ON public.lsore_game_state TO anon, authenticated;

-- Answersテーブル
GRANT ALL ON public.lsore_answers TO anon, authenticated;

-- Votesテーブル
GRANT ALL ON public.lsore_votes TO anon, authenticated;

-- シーケンスへのアクセス権限（UUID生成のため）
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ==============================================
-- 投票数をアトミックにインクリメントする関数（競合状態を防ぐ）
-- ==============================================
CREATE OR REPLACE FUNCTION increment_answer_votes(answer_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE lsore_answers
  SET votes = votes + 1
  WHERE id = answer_id_param;
END;
$$;

-- RPC関数へのアクセス権限
GRANT EXECUTE ON FUNCTION increment_answer_votes(UUID) TO anon, authenticated;
