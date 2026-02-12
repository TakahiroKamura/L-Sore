# 🎲 エルそれ！～エルバニアではそれが正解～

React + TypeScript + Supabaseを使った、リアルタイムお題大喜利ゲームアプリです。

## ✨ 機能

### ゲーム機能
- **お題自動生成**: data.jsonから初期値と単語をランダムに組み合わせ
- **確率調整**: rare値による出現確率の調整
- **逆回答モード**: 低確率（10%）で発動する特殊モード
- **複数抽選**: 最大10個まで同時抽選可能
- **メモ機能**: 抽選結果にメモを追加
- **個別コピー**: 各お題ごとにSNS投稿用フォーマットでコピー

### マルチプレイヤー機能
- **合言葉ログイン**: ルームIDと合言葉でルームに参加
- **ディーラーモード**: お題の出題とゲーム進行を担当
- **プレイヤーモード**: お題に回答・投票して楽しむ
- **リアルタイム同期**: Supabase Realtimeで全員の状態を即座に同期
- **プレイヤー管理**: 参加者の一覧表示とステータス管理

## 🚀 セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Supabaseのセットアップ

詳細は [supabase/README.md](./supabase/README.md) を参照してください。

簡単な手順：
1. [Supabase](https://supabase.com)でプロジェクトを作成
2. `supabase/schema.sql` を実行してテーブルを作成
3. `.env` ファイルに環境変数を設定：

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:5173` を開きます。

### 4. ビルド

```bash
npm run build
```

ビルド結果は `dist/` フォルダに出力されます。

## 🎮 使い方

### ディーラーとして

1. 合言葉を入力してルームに入室
2. 「ディーラーとして入室」を選択
3. プレイヤーが入室するまで待機
4. プレイヤーが1人以上揃ったら「**セッション開始（入室締め切り）**」をクリック
5. お題を抽選して出題
6. 「回答受付開始」→「投票開始」→「結果発表」の順に進行
7. 「次のラウンド」で新しいラウンドへ（セッション開始前に戻る）

### プレイヤーとして

1. 合言葉を入力してルームに入室
2. 「プレイヤーとして入室」を選択
3. ディーラーがセッションを開始するまで待機
4. ディーラーが出題したお題に回答
5. 他のプレイヤーの回答に投票
6. 結果を確認

## 🧪 デバッグモード（一人で複数タブでテスト）

一人で複数のプレイヤーとディーラーをテストしたい場合は**デバッグモード**を使用してください。

URLに `?debug=true` を追加してアクセスします：

```
http://localhost:5173/?debug=true
```

各タブで異なるユーザーIDを指定することもできます：

```
http://localhost:5173/?debug=true&userId=dealer1
http://localhost:5173/?debug=true&userId=player1
http://localhost:5173/?debug=true&userId=player2
```

詳細は [DEBUG.md](./DEBUG.md) を参照してください。

## 📁 プロジェクト構成

```
L-Sore/
├── src/
│   ├── components/       # Reactコンポーネント
│   │   ├── RoomLogin.tsx    # ログイン画面
│   │   ├── RoomLobby.tsx    # ロビー画面
│   │   ├── DealerView.tsx   # ディーラー画面
│   │   └── PlayerView.tsx   # プレイヤー画面
│   ├── hooks/           # カスタムフック
│   ├── lib/             # ライブラリ設定
│   │   └── supabase.ts     # Supabaseクライアント
│   ├── types/           # TypeScript型定義
│   │   ├── database.ts     # データベース型
│   │   └── index.ts        # その他の型
│   ├── utils/           # ユーティリティ関数
│   ├── App.tsx          # メインアプリコンポーネント
│   └── main.tsx         # エントリーポイント
├── supabase/
│   ├── schema.sql       # データベーススキーマ
│   └── README.md        # Supabaseセットアップガイド
├── public/              # 静的ファイル
└── data.json            # お題データ

```

## 🔒 セキュリティについて

このアプリは**性善説**に基づいて設計されています：
- 認証機能はありません（ユーザー名をそのままuser_idとして使用）
- RLSポリシーは最小限（room_idの一致のみチェック）
- 同じ名前を使えば複数タブでも同じプレイヤーとして認識されます
- 悪意のあるユーザーによる不正操作は防げません

**プライベートな環境での使用を推奨します。**

## 🛠 技術スタック

- **Frontend**: React 18, TypeScript, Bootstrap 5
- **Backend**: Supabase (Database, Realtime)
- **Build Tool**: Vite 6
- **Hosting**: Cloudflare Pages (予定)

## 📝 ライセンス

(c) PMK 2025

## 🎨 アイコン生成

アイコンファイルを生成するには：

1. `generate-icons.html`をブラウザで開く
2. 自動的に`icon-192.png`と`icon-512.png`がダウンロードされる
3. ダウンロードしたファイルをプロジェクトルートに配置

## 💾 データ構造

`data.json`は以下の構造で管理されています：

```json
{
  "initial": [
    { "key": "あ", "rare": 0 },
    { "key": "が", "rare": 1 }
  ],
  "words": [
    { "normal": "かたいもの", "not": "かたくないもの", "rare": 0 }
  ]
}
```

- **initial**: ひらがな1文字のリスト（rare=0: 通常, rare=1: 低確率）
- **words**: お題の単語リスト（normal: 通常, not: 逆, rare: 確率調整）

## 🛠️ 技術スタック

- **Frontend**: React 18, TypeScript, Bootstrap 5
- **Backend**: Supabase (Database, Realtime)
- **Build Tool**: Vite 6
- **Hosting**: Cloudflare Pages (予定)

## 🐛 トラブルシューティング

問題が発生した場合は [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) を参照してください。

よくある問題：
- プレイヤー入室が検知されない → Supabase Realtimeの設定を確認
- ゴーストユーザーが残る → ブラウザのキャッシュをクリア
- セッション開始ボタンが押せない → プレイヤーが1人以上必要

## 📝 ライセンス

(c) PMK 2025
