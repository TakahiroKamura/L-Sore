-- テーブル作成SQL

-- Roomsテーブル
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  password TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Playersテーブル
CREATE TABLE IF NOT EXISTS public.players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('dealer', 'player')),
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Game Stateテーブル
CREATE TABLE IF NOT EXISTS public.game_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  current_topic TEXT,
  phase TEXT NOT NULL DEFAULT 'lobby' CHECK (phase IN ('lobby', 'waiting', 'topic_drawn', 'answering', 'voting', 'results')),
  round INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(room_id)
);

-- Answersテーブル
CREATE TABLE IF NOT EXISTS public.answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  game_state_id UUID NOT NULL REFERENCES public.game_state(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  votes INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Votesテーブル
CREATE TABLE IF NOT EXISTS public.votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  answer_id UUID NOT NULL REFERENCES public.answers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(answer_id, user_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_players_room_id ON public.players(room_id);
CREATE INDEX IF NOT EXISTS idx_players_user_id ON public.players(user_id);
CREATE INDEX IF NOT EXISTS idx_game_state_room_id ON public.game_state(room_id);
CREATE INDEX IF NOT EXISTS idx_answers_room_id ON public.answers(room_id);
CREATE INDEX IF NOT EXISTS idx_answers_game_state_id ON public.answers(game_state_id);
CREATE INDEX IF NOT EXISTS idx_votes_room_id ON public.votes(room_id);
CREATE INDEX IF NOT EXISTS idx_votes_answer_id ON public.votes(answer_id);

-- Realtimeを有効化
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.answers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;

-- RLSポリシー設定

-- Roomsテーブル
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rooms are viewable by everyone" ON public.rooms
  FOR SELECT USING (true);

-- Playersテーブル
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view players in same room" ON public.players
  FOR SELECT USING (true);

CREATE POLICY "Players can insert themselves" ON public.players
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Players can update themselves" ON public.players
  FOR UPDATE USING (true);

CREATE POLICY "Players can delete themselves" ON public.players
  FOR DELETE USING (true);

-- Game Stateテーブル
ALTER TABLE public.game_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game state is viewable by everyone" ON public.game_state
  FOR SELECT USING (true);

CREATE POLICY "Game state can be updated by everyone" ON public.game_state
  FOR UPDATE USING (true);

CREATE POLICY "Game state can be inserted by everyone" ON public.game_state
  FOR INSERT WITH CHECK (true);

-- Answersテーブル
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Answers are viewable by everyone" ON public.answers
  FOR SELECT USING (true);

CREATE POLICY "Answers can be inserted by everyone" ON public.answers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Answers can be updated by everyone" ON public.answers
  FOR UPDATE USING (true);

CREATE POLICY "Answers can be deleted by everyone" ON public.answers
  FOR DELETE USING (true);

-- Votesテーブル
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Votes are viewable by everyone" ON public.votes
  FOR SELECT USING (true);

CREATE POLICY "Votes can be inserted by everyone" ON public.votes
  FOR INSERT WITH CHECK (true);

-- 初期データ投入（サンプルルーム）
INSERT INTO public.rooms (name, password) VALUES
  ('テストルーム1', 'test1'),
  ('テストルーム2', 'test2'),
  ('テストルーム3', 'test3')
ON CONFLICT (password) DO NOTHING;

-- GRANT権限を追加してanonロールでのアクセスを許可する
-- これにより認証なしでテーブルにアクセスできるようになる

-- スキーマへのアクセス権限
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Roomsテーブル
GRANT SELECT ON public.rooms TO anon, authenticated;

-- Playersテーブル
GRANT ALL ON public.players TO anon, authenticated;

-- Game Stateテーブル
GRANT ALL ON public.game_state TO anon, authenticated;

-- Answersテーブル
GRANT ALL ON public.answers TO anon, authenticated;

-- Votesテーブル
GRANT ALL ON public.votes TO anon, authenticated;

-- シーケンスへのアクセス権限（UUID生成のため）
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
