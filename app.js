// アプリケーション状態
class OdaiGameMaker {
    constructor() {
        this.data = null; // data.jsonから読み込むデータ
        this.currentResults = [];
        this.settings = {
            appTitle: 'お題ゲームメーカー',
            streamUrl: '',
            hashtag: '#お題ゲーム'
        };
        this.init();
    }

    async init() {
        await this.loadData();
        this.loadFromStorage();
        this.setupEventListeners();
    }

    // data.jsonからデータを読み込み
    async loadData() {
        try {
            const response = await fetch('data.json');
            this.data = await response.json();
            console.log('data.json loaded:', this.data);
        } catch (error) {
            console.error('data.jsonの読み込みに失敗しました:', error);
            alert('データの読み込みに失敗しました');
        }
    }

    // LocalStorageからデータを読み込み
    loadFromStorage() {
        try {
            const savedSettings = localStorage.getItem('odai_settings');

            if (savedSettings) {
                this.settings = JSON.parse(savedSettings);
                this.applySettings();
            }
        } catch (error) {
            console.error('データの読み込みに失敗しました:', error);
        }
    }

    // LocalStorageにデータを保存
    saveToStorage() {
        try {
            localStorage.setItem('odai_settings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('データの保存に失敗しました:', error);
        }
    }

    // 設定をフォームに適用
    applySettings() {
        document.getElementById('appTitle').value = this.settings.appTitle;
        document.getElementById('streamUrl').value = this.settings.streamUrl;
        document.getElementById('hashtag').value = this.settings.hashtag;
    }

    // イベントリスナーの設定
    setupEventListeners() {
        // 抽選ボタン（1つ追加）
        document.getElementById('drawOneBtn').addEventListener('click', () => {
            this.drawOneTopic();
        });

        // 一括抽選ボタン（満枠まで追加）
        document.getElementById('drawMaxBtn').addEventListener('click', () => {
            this.drawMaxTopics();
        });

        // コピーボタン
        document.getElementById('copyBtn').addEventListener('click', () => {
            this.copyResults();
        });

        // 結果クリアボタン
        document.getElementById('clearResultBtn').addEventListener('click', () => {
            this.clearResults();
        });

        // 設定の変更を監視
        ['appTitle', 'streamUrl', 'hashtag'].forEach(id => {
            document.getElementById(id).addEventListener('change', (e) => {
                this.settings[id.replace(/([A-Z])/g, '_$1').toLowerCase()] = e.target.value;
                this.settings.appTitle = document.getElementById('appTitle').value || 'お題ゲームメーカー';
                this.settings.streamUrl = document.getElementById('streamUrl').value;
                this.settings.hashtag = document.getElementById('hashtag').value || '#お題ゲーム';
                this.saveToStorage();
            });
        });
    }

    // data.jsonからランダムにお題を生成
    generateTopic() {
        if (!this.data || !this.data.initial || !this.data.words) {
            console.error('データが読み込まれていません');
            return null;
        }

        // initialからランダムに選択（rareの確率を考慮）
        const initial = this.weightedRandomSelect(this.data.initial);

        // wordsからランダムに選択（rareの確率を考慮）
        const word = this.weightedRandomSelect(this.data.words);

        if (!initial || !word) {
            return null;
        }

        // 低確率（10%）で逆回答モード
        const isReverse = Math.random() < 0.1;

        // 逆回答の場合はnotを使用、通常はnormalまたはnotをランダムに選択
        let wordText;
        if (isReverse) {
            wordText = word.not;
        } else {
            wordText = Math.random() < 0.5 ? word.normal : word.not;
        }

        // テンプレート: (initial.key)から始まる(word)といえば？
        return {
            text: `「${initial.key}」から始まる「${wordText}」といえば？`,
            isReverse: isReverse
        };
    }

    // 重み付きランダム選択（rareの値に基づく）
    // initialとwordsの両方でrareキーを考慮
    // rare=0: 通常の出現率（重み10）
    // rare=1: 低確率（重み3）
    // rare=2: 極低確率（重み1）
    weightedRandomSelect(items) {
        if (!items || items.length === 0) return null;

        // rare値に基づいて重みを計算
        const weights = items.map(item => {
            const rare = item.rare || 0;
            return Math.max(1, 10 - rare * 3);
        });

        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        let random = Math.random() * totalWeight;

        for (let i = 0; i < items.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return items[i];
            }
        }

        return items[0]; // フォールバック
    }

    // お題を1つ抽選（既存の結果に追加）
    drawOneTopic() {
        const maxDraw = parseInt(document.getElementById('maxDraw').value) || 5;

        if (!this.data) {
            alert('データが読み込まれていません');
            return;
        }

        // 現在の結果数が最大数に達していないかチェック
        if (this.currentResults.length >= maxDraw) {
            alert(`最大抽選数（${maxDraw}個）に達しています`);
            return;
        }

        const topic = this.generateTopic();
        if (!topic) {
            alert('お題の生成に失敗しました');
            return;
        }

        // 既存の結果に追加
        this.currentResults.push({
            id: Date.now(),
            text: topic.text,
            isReverse: topic.isReverse,
            memo: '',
            drawnAt: new Date()
        });

        this.renderResults();
    }

    // お題を最大数まで一括抽選（既存の結果に追加）
    drawMaxTopics() {
        const maxDraw = parseInt(document.getElementById('maxDraw').value) || 5;

        if (!this.data) {
            alert('データが読み込まれていません');
            return;
        }

        // 現在の結果数から、あと何個追加できるかを計算
        const remainingSlots = maxDraw - this.currentResults.length;

        if (remainingSlots <= 0) {
            alert(`最大抽選数（${maxDraw}個）に達しています`);
            return;
        }

        // 残りのスロット数だけお題を生成
        for (let i = 0; i < remainingSlots; i++) {
            const topic = this.generateTopic();
            if (topic) {
                this.currentResults.push({
                    id: Date.now() + i,
                    text: topic.text,
                    isReverse: topic.isReverse,
                    memo: '',
                    drawnAt: new Date()
                });
            }
        }

        this.renderResults();
    }

    // 結果をクリア
    clearResults() {
        if (this.currentResults.length === 0) {
            return;
        }

        if (confirm('抽選結果をクリアしますか？')) {
            this.currentResults = [];
            this.renderResults();
        }
    }

    // 結果をコピー（全体）
    copyResults() {
        if (this.currentResults.length === 0) {
            alert('抽選結果がありません');
            return;
        }

        const texts = this.currentResults.map(result => {
            const memo = result.memo ? `\nメモ: ${result.memo}` : '';
            return `【${this.settings.appTitle}】お題「${result.text}」を使ってゲーム中！　気になった人はこちら！${this.settings.streamUrl} ${this.settings.hashtag}${memo}`;
        });

        const copyText = texts.join('\n\n');

        navigator.clipboard.writeText(copyText).then(() => {
            alert('クリップボードにコピーしました！');
        }).catch(err => {
            console.error('コピーに失敗しました:', err);
            alert('コピーに失敗しました');
        });
    }

    // 個別の結果をコピー
    copySingleResult(index) {
        if (!this.currentResults[index]) {
            alert('お題が見つかりません');
            return;
        }

        const result = this.currentResults[index];
        const memo = result.memo ? `\nメモ: ${result.memo}` : '';
        const copyText = `【${this.settings.appTitle}】お題「${result.text}」を使ってゲーム中！　気になった人はこちら！${this.settings.streamUrl} ${this.settings.hashtag}${memo}`;

        navigator.clipboard.writeText(copyText).then(() => {
            alert('クリップボードにコピーしました！');
        }).catch(err => {
            console.error('コピーに失敗しました:', err);
            alert('コピーに失敗しました');
        });
    }

    // メモを更新
    updateMemo(index, memo) {
        if (this.currentResults[index]) {
            this.currentResults[index].memo = memo;
        }
    }

    // 特定のお題を再抽選
    redrawTopic(index) {
        if (!this.data) {
            alert('データが読み込まれていません');
            return;
        }

        const newTopic = this.generateTopic();
        if (!newTopic) {
            alert('お題の生成に失敗しました');
            return;
        }

        // 結果を更新
        this.currentResults[index] = {
            id: Date.now(),
            text: newTopic.text,
            isReverse: newTopic.isReverse,
            memo: this.currentResults[index].memo || '', // メモは保持
            drawnAt: new Date()
        };

        this.renderResults();
    }

    // 抽選結果を描画
    renderResults() {
        const container = document.getElementById('resultContainer');
        const resultList = document.getElementById('resultList');

        if (this.currentResults.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        resultList.innerHTML = this.currentResults.map((result, index) => {
            const reverseClass = result.isReverse ? ' reverse' : '';
            return `
            <div class="result-item${reverseClass}">
                <div class="result-header">
                    <div class="result-topic">${this.escapeHtml(result.text)}</div>
                    <div class="result-actions">
                        <button class="btn btn-redraw" onclick="app.redrawTopic(${index})">再抽選</button>
                        <button class="btn btn-secondary" onclick="app.copySingleResult(${index})">コピー</button>
                    </div>
                </div>
                <div class="result-memo">
                    <label>メモ・備考：</label>
                    <textarea 
                        rows="2" 
                        placeholder="メモを入力..."
                        onchange="app.updateMemo(${index}, this.value)"
                    >${result.memo || ''}</textarea>
                </div>
            </div>
        `;
        }).join('');
    }

    // HTMLエスケープ
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// アプリケーションの初期化
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new OdaiGameMaker();
});
