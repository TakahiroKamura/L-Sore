# Supabaseセットアップガイド

## 1. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com)にアクセスし、新しいプロジェクトを作成します
2. プロジェクト名、データベースパスワードを設定します
3. リージョンを選択します（日本の場合は `ap-northeast-1` を推奨）

## 2. データベースのセットアップ

### 初期セットアップ

1. Supabaseのダッシュボードで「SQL Editor」を開きます
2. `supabase/schema.sql` の内容をコピーして実行します
3. これにより、以下のテーブルとRLSポリシーが作成されます：
   - `rooms`: ルーム情報
   - `players`: プレイヤー情報
   - `game_state`: ゲーム状態
   - `answers`: 回答
   - `votes`: 投票

### マイグレーション適用（既存のデータベース用）

既にデータベースが作成済みで、権限エラー（406エラー）が発生する場合：

1. Supabaseのダッシュボードで「SQL Editor」を開きます
2. `supabase/migration_fix_permissions.sql` の内容をコピーして実行します
3. これにより、`anon`ロールに必要な権限が付与されます

**重要**: 権限エラーが発生している場合は、このマイグレーションを必ず実行してください。 

## 3. 環境変数の設定

1. プロジェクトのルートに `.env` ファイルを作成します
2. Supabaseダッシュボードの「Settings」→「API」から以下の情報を取得します：
   - Project URL
   - anon public key

3. `.env` ファイルに以下の形式で記述します：

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 4. Realtimeの有効化

Supabaseダッシュボードで以下のテーブルのRealtimeを有効化します：
- `players`
- `game_state`
- `answers`
- `votes`

手順：
1. 「Table Editor」を開きます
2. 各テーブルを選択します
3. 右上の設定アイコンをクリックします
4. 「Enable Realtime」をONにします

## 5. 初期データの確認

`schema.sql`で以下の3つのテストルームが作成されます：
- 合言葉: `test1` (テストルーム1)
- 合言葉: `test2` (テストルーム2)
- 合言葉: `test3` (テストルーム3)

これらの合言葉を使ってアプリにログインできます。

## 6. 本番環境でのルーム追加

本番環境で新しいルームを追加する場合は、以下のSQLを実行します：

```sql
INSERT INTO public.rooms (name, password) VALUES
  ('新しいルーム名', '合言葉');
```

## セキュリティに関する注意

このアプリは性善説に基づいて設計されています：
- 認証機能はありません
- RLSポリシーは最小限です
- 悪意のあるユーザーによる不正操作は防げません

プライベートな環境での使用を推奨します。
