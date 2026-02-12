-- lobbyフェーズを追加するマイグレーション
-- 既存のデータベースに対して実行してください

-- 1. 既存のCHECK制約を削除
ALTER TABLE public.game_state 
DROP CONSTRAINT IF EXISTS game_state_phase_check;

-- 2. 新しいCHECK制約を追加（lobbyを含む）
ALTER TABLE public.game_state 
ADD CONSTRAINT game_state_phase_check 
CHECK (phase IN ('lobby', 'waiting', 'topic_drawn', 'answering', 'voting', 'results'));

-- 3. デフォルト値をlobbyに変更
ALTER TABLE public.game_state 
ALTER COLUMN phase SET DEFAULT 'lobby';

-- 4. （オプション）既存のwaitingデータをlobbyに更新したい場合
-- UPDATE public.game_state SET phase = 'lobby' WHERE phase = 'waiting' AND round = 0;
