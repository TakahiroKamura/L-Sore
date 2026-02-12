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
