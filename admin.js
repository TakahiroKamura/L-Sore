// 管理画面のパスワード（実際の運用では環境変数などで管理）
const ADMIN_PASSWORD = 'admin123';
const SESSION_KEY = 'admin_session';

let data = null;

// ログイン処理
function login() {
    const password = document.getElementById('password').value;

    if (password === ADMIN_PASSWORD) {
        sessionStorage.setItem(SESSION_KEY, 'true');
        showAdmin();
    } else {
        alert('パスワードが正しくありません');
    }
}

// ログアウト処理
function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
}

// セッションチェック
function checkSession() {
    const isLoggedIn = sessionStorage.getItem(SESSION_KEY) === 'true';

    if (isLoggedIn) {
        showAdmin();
    } else {
        document.getElementById('loginContainer').style.display = 'block';
        document.getElementById('adminContainer').style.display = 'none';
    }
}

// 管理画面表示
async function showAdmin() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('adminContainer').style.display = 'block';

    await loadData();
    renderWordList();
}

// data.jsonを読み込み
async function loadData() {
    try {
        const response = await fetch('data.json');
        data = await response.json();
        console.log('data.json loaded:', data);
    } catch (error) {
        console.error('データの読み込みに失敗しました:', error);
        alert('データの読み込みに失敗しました');
    }
}

// お題リストを描画
function renderWordList() {
    if (!data || !data.words) return;

    const container = document.getElementById('wordList');
    const countElement = document.getElementById('wordCount');

    countElement.textContent = data.words.length;

    container.innerHTML = data.words.map((word, index) => `
        <div class="word-item">
            <input type="text" value="${escapeHtml(word.normal)}" 
                   onchange="updateWord(${index}, 'normal', this.value)" 
                   placeholder="通常">
            <input type="text" value="${escapeHtml(word.not)}" 
                   onchange="updateWord(${index}, 'not', this.value)" 
                   placeholder="逆">
            <div class="rare-input">
                <label>Rare</label>
                <input type="number" value="${word.rare || 0}" 
                       onchange="updateWord(${index}, 'rare', parseInt(this.value))" 
                       min="0" max="2">
            </div>
            <div class="word-actions">
                <button class="btn btn-danger btn-small" onclick="deleteWord(${index})">削除</button>
            </div>
        </div>
    `).join('');
}

// お題を追加
function addWord() {
    const normal = document.getElementById('newNormal').value.trim();
    const not = document.getElementById('newNot').value.trim();
    const rare = parseInt(document.getElementById('newRare').value) || 0;

    if (!normal || !not) {
        alert('通常と逆の両方を入力してください');
        return;
    }

    data.words.push({
        normal: normal,
        not: not,
        rare: rare
    });

    // 入力欄をクリア
    document.getElementById('newNormal').value = '';
    document.getElementById('newNot').value = '';
    document.getElementById('newRare').value = '0';

    renderWordList();
}

// お題を更新
function updateWord(index, field, value) {
    if (data && data.words[index]) {
        data.words[index][field] = value;
    }
}

// お題を削除
function deleteWord(index) {
    if (confirm('このお題を削除しますか？')) {
        data.words.splice(index, 1);
        renderWordList();
    }
}

// データを保存（ダウンロード）
function saveData() {
    if (!data) {
        alert('データが読み込まれていません');
        return;
    }

    const dataStr = JSON.stringify(data, null, 4);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data.json`;
    a.click();
    URL.revokeObjectURL(url);

    alert('data.jsonをダウンロードしました。\nファイルを置き換えて変更を反映してください。');
}

// HTMLエスケープ
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Enterキーでログイン
document.addEventListener('DOMContentLoaded', () => {
    checkSession();

    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                login();
            }
        });
    }
});
