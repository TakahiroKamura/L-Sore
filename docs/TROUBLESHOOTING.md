# トラブルシューティングガイド

## 問題1: プレイヤー入室が検知されない

### 症状
- プレイヤーが「プレイヤーとして入室」を押しても、ディーラー画面に表示されない
- セッション開始ボタンがずっとグレーアウトのまま

### 原因
1. Supabase Realtimeが有効になっていない
2. Realtime接続が失敗している
3. RLSポリシーの問題

### 解決方法

#### 1. Supabase Realtimeの有効化を確認

Supabaseダッシュボードで以下を確認：

1. 左メニューから「Database」→「Replication」を開く
2. `players`テーブルを探す
3. 「Source」列のトグルスイッチが**ON**になっているか確認
4. OFFの場合はONにする

または、SQLエディタで以下を実行：

```sql
-- Realtimeを有効化
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.answers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
```

#### 2. ブラウザコンソールでログを確認

F12キーでデベロッパーツールを開き、コンソールを確認：

**正常な場合:**
```
[Dealer] Realtime接続状態: SUBSCRIBED
[Lobby] Realtime接続状態: SUBSCRIBED
[Player] GameState Realtime接続状態: SUBSCRIBED
```

**異常な場合:**
```
[Dealer] Realtime接続状態: CHANNEL_ERROR
[Dealer] Realtime接続状態: TIMED_OUT
```

#### 3. 環境変数の確認

`.env`ファイルを確認：
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- URLとキーが正しいか
- `VITE_`プレフィックスがあるか
- `.env`ファイルがプロジェクトルートにあるか

#### 4. 開発サーバーの再起動

環境変数を変更した場合、必ず再起動：
```bash
# Ctrl+C で停止
npm run dev
```

#### 5. データベースの直接確認

SQLエディタで以下を実行：
```sql
SELECT * FROM players WHERE room_id = 'your-room-id' AND is_active = true;
```

プレイヤーがデータベースに存在するか確認。

## 問題2: ゴーストユーザーが残る

### 症状
- ページをリロードしたり閉じたりすると、古いプレイヤーが残る
- 同じユーザーが複数表示される

### 原因
- ページ離脱時の`is_active`更新が実行されていない
- 再入室時に古いレコードが無効化されていない

### 解決方法

#### 修正済みの実装

最新のコードでは以下の対策を実装済み：

1. **入室時に古いレコードを無効化**
   ```typescript
   // 既存の同一ユーザーのレコードを無効化
   await supabase
     .from('players')
     .update({ is_active: false })
     .eq('room_id', room.id)
     .eq('user_id', userId);
   ```

2. **ページ離脱時の自動クリーンアップ**
   ```typescript
   // beforeunloadイベントで自動的にis_activeをfalseに
   window.addEventListener('beforeunload', handleBeforeUnload);
   ```

#### 手動でゴーストを削除

それでもゴーストが残る場合、SQLエディタで手動削除：

```sql
-- 全てのゴーストを削除
UPDATE players SET is_active = false WHERE room_id = 'your-room-id';

-- または完全に削除
DELETE FROM players WHERE room_id = 'your-room-id';
```

#### ブラウザキャッシュのクリア

1. F12でデベロッパーツールを開く
2. 「Application」タブ（Chromeの場合）
3. 「Storage」→「Clear site data」
4. ページをリロード

## デバッグ情報の見方

### コンソールログの意味

```
[App] プレイヤー登録成功: プレイヤー1 player
→ プレイヤーがデータベースに登録された

[Lobby] Realtime接続状態: SUBSCRIBED
→ Realtimeチャンネルに接続成功

[Lobby] プレイヤー変更検知: {eventType: "INSERT", ...}
→ プレイヤーの変更を検知した

[Lobby] プレイヤー読み込み: 2 人
→ 現在2人のプレイヤーがアクティブ

[Dealer] プレイヤー読み込み: 2 人
→ ディーラー画面でも2人を認識
```

### エラーメッセージ

**"Realtimeの環境変数が設定されていません"**
- `.env`ファイルがない、または環境変数が間違っている

**"合言葉が正しくありません"**
- roomsテーブルに該当するパスワードがない
- `supabase/schema.sql`の初期データを確認

**"入室に失敗しました"**
- RLSポリシーの問題
- ネットワークエラー
- Supabaseプロジェクトが停止している

## Supabaseダッシュボードでの確認

### 1. Table Editorでデータを確認

1. 左メニューから「Table Editor」を開く
2. `players`テーブルを選択
3. `is_active = true`でフィルター
4. 実際のデータを確認

### 2. Logsでエラーを確認

1. 左メニューから「Logs」を開く
2. 「Postgres Logs」を選択
3. エラーメッセージを確認

### 3. API Logsでリクエストを確認

1. 左メニューから「Logs」→「API」を開く
2. 最近のリクエストを確認
3. ステータスコードが200以外の場合は問題あり

## よくある質問

### Q: デバッグモードでもゴーストが出る？
A: はい、beforeunloadイベントはデバッグモードでも同様に動作します。ただし、ブラウザのクラッシュなど異常終了の場合は検知できません。

### Q: セッション開始ボタンが押せない
A: プレイヤーが1人以上必要です。コンソールで`[Dealer] プレイヤー読み込み: 0 人`と表示されていないか確認してください。

### Q: Realtimeの接続が時々切れる
A: Supabaseの無料プランでは接続数に制限があります。同時接続数が多い場合は切断される可能性があります。

### Q: ローカルストレージをクリアしたい
A: F12 → Application → Local Storage → localhost:5173 → 右クリック → Clear

## サポート情報

問題が解決しない場合は、以下の情報を添えて報告してください：

1. ブラウザのコンソールログ（F12）
2. 使用しているブラウザとバージョン
3. Supabaseプロジェクトのリージョン
4. エラーが発生する手順
5. `.env`ファイルの内容（キーは隠して）
