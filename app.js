// アプリケーション状態
class OdaiGameMaker {
    constructor() {
        this.topics = [];
        this.history = [];
        this.currentResults = [];
        this.settings = {
            appTitle: 'お題ゲームメーカー',
            streamUrl: '',
            hashtag: '#お題ゲーム'
        };
        this.init();
    }

    init() {
        this.loadFromStorage();
        this.setupEventListeners();
        this.render();
    }

    // LocalStorageからデータを読み込み
    loadFromStorage() {
        try {
            const savedTopics = localStorage.getItem('odai_topics');
            const savedHistory = localStorage.getItem('odai_history');
            const savedSettings = localStorage.getItem('odai_settings');

            if (savedTopics) {
                this.topics = JSON.parse(savedTopics);
            }
            if (savedHistory) {
                this.history = JSON.parse(savedHistory);
            }
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
            localStorage.setItem('odai_topics', JSON.stringify(this.topics));
            localStorage.setItem('odai_history', JSON.stringify(this.history));
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
        // お題追加ボタン
        document.getElementById('addTopicBtn').addEventListener('click', () => {
            this.addTopic();
        });

        // 抽選ボタン
        document.getElementById('drawBtn').addEventListener('click', () => {
            this.drawTopics();
        });

        // コピーボタン
        document.getElementById('copyBtn').addEventListener('click', () => {
            this.copyResults();
        });

        // 履歴クリアボタン
        document.getElementById('clearHistoryBtn').addEventListener('click', () => {
            this.clearHistory();
        });

        // エクスポートボタン
        document.getElementById('exportJsonBtn').addEventListener('click', () => {
            this.exportJson();
        });

        document.getElementById('exportCsvBtn').addEventListener('click', () => {
            this.exportCsv();
        });

        // インポートファイル
        document.getElementById('importFile').addEventListener('change', (e) => {
            this.importFile(e.target.files[0]);
            e.target.value = ''; // リセット
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

    // お題を追加
    addTopic() {
        const input = document.getElementById('topicInput');
        const weightInput = document.getElementById('topicWeight');
        const text = input.value.trim();
        const weight = parseInt(weightInput.value) || 1;

        if (!text) {
            alert('お題を入力してください');
            return;
        }

        const topic = {
            id: Date.now(),
            text: text,
            weight: Math.max(1, Math.min(10, weight)), // 1-10の範囲に制限
            createdAt: new Date().toISOString()
        };

        this.topics.push(topic);
        this.saveToStorage();

        input.value = '';
        weightInput.value = 1;

        this.renderTopicList();
    }

    // お題を削除
    deleteTopic(id) {
        if (confirm('このお題を削除しますか？')) {
            this.topics = this.topics.filter(t => t.id !== id);
            this.saveToStorage();
            this.renderTopicList();
        }
    }

    // お題を抽選（重み付き抽選）
    drawTopics() {
        const maxDraw = parseInt(document.getElementById('maxDraw').value) || 1;

        if (this.topics.length === 0) {
            alert('お題が登録されていません');
            return;
        }

        const count = Math.min(maxDraw, this.topics.length);
        const drawn = this.weightedRandomDraw(this.topics, count);

        this.currentResults = drawn.map(topic => ({
            ...topic,
            memo: '',
            drawnAt: new Date()
        }));

        // 履歴に追加
        this.addToHistory(this.currentResults);

        this.renderResults();
    }

    // 重み付きランダム抽選
    weightedRandomDraw(topics, count) {
        const available = [...topics];
        const results = [];

        for (let i = 0; i < count && available.length > 0; i++) {
            // 重みの合計を計算
            const totalWeight = available.reduce((sum, topic) => sum + topic.weight, 0);

            // ランダムな値を生成
            let random = Math.random() * totalWeight;

            // 重みに基づいて選択
            let selectedIndex = 0;
            for (let j = 0; j < available.length; j++) {
                random -= available[j].weight;
                if (random <= 0) {
                    selectedIndex = j;
                    break;
                }
            }

            results.push(available[selectedIndex]);
            available.splice(selectedIndex, 1); // 重複を避ける
        }

        return results;
    }

    // 履歴に追加
    addToHistory(results) {
        const historyEntry = {
            id: Date.now(),
            results: results,
            timestamp: new Date().toISOString()
        };

        this.history.unshift(historyEntry);

        // 履歴は最大50件まで
        if (this.history.length > 50) {
            this.history = this.history.slice(0, 50);
        }

        this.saveToStorage();
        this.renderHistory();
    }

    // 履歴をクリア
    clearHistory() {
        if (confirm('履歴をすべて削除しますか？')) {
            this.history = [];
            this.saveToStorage();
            this.renderHistory();
        }
    }

    // 結果をコピー
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

    // メモを更新
    updateMemo(index, memo) {
        if (this.currentResults[index]) {
            this.currentResults[index].memo = memo;
        }
    }

    // 特定のお題を再抽選
    redrawTopic(index) {
        if (this.topics.length === 0) {
            alert('お題が登録されていません');
            return;
        }

        // 現在の結果から除外されたお題リストを作成
        const currentTopicIds = this.currentResults.map(r => r.id);
        const availableTopics = this.topics.filter(t => !currentTopicIds.includes(t.id) || t.id === this.currentResults[index].id);

        if (availableTopics.length === 0) {
            alert('他に抽選可能なお題がありません');
            return;
        }

        // 1つだけ再抽選
        const drawn = this.weightedRandomDraw(availableTopics, 1)[0];

        // 結果を更新
        this.currentResults[index] = {
            ...drawn,
            memo: this.currentResults[index].memo || '', // メモは保持
            drawnAt: new Date()
        };

        this.renderResults();
    }

    // JSONエクスポート
    exportJson() {
        const data = {
            topics: this.topics,
            settings: this.settings,
            exportedAt: new Date().toISOString()
        };

        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `odai-topics-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);

        alert('JSONファイルをエクスポートしました');
    }

    // CSVエクスポート
    exportCsv() {
        if (this.topics.length === 0) {
            alert('お題が登録されていません');
            return;
        }

        // CSVヘッダー
        let csv = 'お題,重み\n';

        // データ行
        this.topics.forEach(topic => {
            const text = topic.text.replace(/"/g, '""'); // ダブルクォートのエスケープ
            csv += `"${text}",${topic.weight}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `odai-topics-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        alert('CSVファイルをエクスポートしました');
    }

    // ファイルインポート
    async importFile(file) {
        if (!file) return;

        const fileType = file.name.split('.').pop().toLowerCase();

        try {
            const text = await file.text();

            if (fileType === 'json') {
                this.importJson(text);
            } else if (fileType === 'csv') {
                this.importCsv(text);
            } else {
                alert('対応していないファイル形式です。.json または .csv ファイルを選択してください。');
            }
        } catch (error) {
            console.error('ファイルの読み込みに失敗しました:', error);
            alert('ファイルの読み込みに失敗しました');
        }
    }

    // JSONインポート
    importJson(jsonText) {
        try {
            const data = JSON.parse(jsonText);

            if (!data.topics || !Array.isArray(data.topics)) {
                alert('無効なJSONファイルです');
                return;
            }

            const importCount = data.topics.length;

            if (confirm(`${importCount}件のお題をインポートしますか？\n既存のお題に追加されます。`)) {
                // 既存のIDと重複しないように新しいIDを割り当て
                data.topics.forEach(topic => {
                    this.topics.push({
                        ...topic,
                        id: Date.now() + Math.random(), // 一意のIDを生成
                        createdAt: topic.createdAt || new Date().toISOString()
                    });
                });

                // 設定もインポートする場合
                if (data.settings && confirm('設定もインポートしますか？')) {
                    this.settings = { ...this.settings, ...data.settings };
                    this.applySettings();
                }

                this.saveToStorage();
                this.render();
                alert(`${importCount}件のお題をインポートしました`);
            }
        } catch (error) {
            console.error('JSONの解析に失敗しました:', error);
            alert('JSONファイルの形式が正しくありません');
        }
    }

    // CSVインポート
    importCsv(csvText) {
        try {
            const lines = csvText.split('\n').filter(line => line.trim());

            // ヘッダー行をスキップ
            const dataLines = lines[0].includes('お題') ? lines.slice(1) : lines;

            if (dataLines.length === 0) {
                alert('CSVファイルにデータがありません');
                return;
            }

            const topics = [];
            dataLines.forEach(line => {
                // CSVパース（簡易版）
                const match = line.match(/^"(.+)",(\d+)$/) || line.match(/^([^,]+),(\d+)$/);
                if (match) {
                    const text = match[1].replace(/""/g, '"').trim();
                    const weight = parseInt(match[2]) || 1;

                    if (text) {
                        topics.push({
                            id: Date.now() + Math.random(),
                            text: text,
                            weight: Math.max(1, Math.min(10, weight)),
                            createdAt: new Date().toISOString()
                        });
                    }
                }
            });

            if (topics.length === 0) {
                alert('インポート可能なデータが見つかりませんでした');
                return;
            }

            if (confirm(`${topics.length}件のお題をインポートしますか？\n既存のお題に追加されます。`)) {
                this.topics.push(...topics);
                this.saveToStorage();
                this.render();
                alert(`${topics.length}件のお題をインポートしました`);
            }
        } catch (error) {
            console.error('CSVの解析に失敗しました:', error);
            alert('CSVファイルの形式が正しくありません');
        }
    }

    // 画面を更新
    render() {
        this.renderTopicList();
        this.renderHistory();
    }

    // お題リストを描画
    renderTopicList() {
        const container = document.getElementById('topicListContainer');

        if (this.topics.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = this.topics.map(topic => `
            <div class="topic-list-item">
                <div class="topic-content">
                    <div class="topic-text">${this.escapeHtml(topic.text)}</div>
                    <div class="topic-weight">重み: ${topic.weight}</div>
                </div>
                <div class="topic-actions">
                    <button class="btn btn-danger" onclick="app.deleteTopic(${topic.id})">削除</button>
                </div>
            </div>
        `).join('');
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
        resultList.innerHTML = this.currentResults.map((result, index) => `
            <div class="result-item">
                <div class="result-header">
                    <div class="result-topic">${this.escapeHtml(result.text)}</div>
                    <button class="btn btn-redraw" onclick="app.redrawTopic(${index})">再抽選</button>
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
        `).join('');
    }

    // 履歴を描画
    renderHistory() {
        const container = document.getElementById('historyContainer');

        if (this.history.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = this.history.map(entry => {
            const date = new Date(entry.timestamp);
            const dateStr = date.toLocaleString('ja-JP');
            const topics = entry.results.map(r => r.text).join(', ');

            return `
                <div class="history-item">
                    <div class="history-time">${dateStr}</div>
                    <div class="history-topic">${this.escapeHtml(topics)}</div>
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
