import { useCallback, useEffect, useState } from 'react';
import { DrawResult, GameData, Settings } from '../types';
import { generateTopic } from '../utils/gameLogic';

export const useGameLogic = () => {
  const [data, setData] = useState<GameData | null>(null);
  const [currentResults, setCurrentResults] = useState<DrawResult[]>([]);
  const [settings, setSettings] = useState<Settings>({
    appTitle: 'お題ゲームメーカー',
    streamUrl: '',
    hashtag: '#お題ゲーム',
  });

  // data.jsonの読み込み
  useEffect(() => {
    fetch('/data.json')
      .then((res) => res.json())
      .then((jsonData: GameData) => {
        setData(jsonData);
        console.log('data.json loaded:', jsonData);
      })
      .catch((error) => {
        console.error('data.jsonの読み込みに失敗しました:', error);
        alert('データの読み込みに失敗しました');
      });
  }, []);

  // LocalStorageから設定を読み込み
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('odai_settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('データの読み込みに失敗しました:', error);
    }
  }, []);

  // 設定をLocalStorageに保存
  const saveSettings = useCallback((newSettings: Settings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('odai_settings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('データの保存に失敗しました:', error);
    }
  }, []);

  // お題を1つ抽選
  const drawOneTopic = useCallback(
    (maxDraw: number): DrawResult | null => {
      if (!data) {
        alert('データが読み込まれていません');
        return null;
      }

      if (currentResults.length >= maxDraw) {
        alert(`最大抽選数（${maxDraw}個）に達しています`);
        return null;
      }

      const topic = generateTopic(data);
      if (!topic) {
        alert('お題の生成に失敗しました');
        return null;
      }

      const newResult: DrawResult = {
        id: Date.now(),
        text: topic.text,
        isReverse: topic.isReverse,
        memo: '',
        drawnAt: new Date(),
      };

      setCurrentResults((prev) => [...prev, newResult]);
      return newResult;
    },
    [data, currentResults]
  );

  // お題を最大数まで一括抽選
  const drawMaxTopics = useCallback(
    (maxDraw: number) => {
      if (!data) {
        alert('データが読み込まれていません');
        return;
      }

      const remainingSlots = maxDraw - currentResults.length;

      if (remainingSlots <= 0) {
        alert(`最大抽選数（${maxDraw}個）に達しています`);
        return;
      }

      const newResults: DrawResult[] = [];
      for (let i = 0; i < remainingSlots; i++) {
        const topic = generateTopic(data);
        if (topic) {
          newResults.push({
            id: Date.now() + i,
            text: topic.text,
            isReverse: topic.isReverse,
            memo: '',
            drawnAt: new Date(),
          });
        }
      }

      setCurrentResults((prev) => [...prev, ...newResults]);
    },
    [data, currentResults]
  );

  // 特定のお題を再抽選
  const redrawTopic = useCallback(
    (index: number) => {
      if (!data) {
        alert('データが読み込まれていません');
        return;
      }

      const newTopic = generateTopic(data);
      if (!newTopic) {
        alert('お題の生成に失敗しました');
        return;
      }

      setCurrentResults((prev) => {
        const updated = [...prev];
        updated[index] = {
          id: Date.now(),
          text: newTopic.text,
          isReverse: newTopic.isReverse,
          memo: updated[index].memo || '',
          drawnAt: new Date(),
        };
        return updated;
      });
    },
    [data]
  );

  // メモを更新
  const updateMemo = useCallback((index: number, memo: string) => {
    setCurrentResults((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index].memo = memo;
      }
      return updated;
    });
  }, []);

  // 結果をクリア
  const clearResults = useCallback(() => {
    if (currentResults.length === 0) {
      return;
    }

    if (window.confirm('抽選結果をクリアしますか？')) {
      setCurrentResults([]);
    }
  }, [currentResults]);

  // 個別の結果をコピー
  const copySingleResult = useCallback(
    (index: number) => {
      const result = currentResults[index];
      if (!result) {
        alert('お題が見つかりません');
        return;
      }

      const memo = result.memo ? `\nメモ: ${result.memo}` : '';
      const copyText = `【${settings.appTitle}】お題「${result.text}」を使ってゲーム中！　気になった人はこちら！${settings.streamUrl} ${settings.hashtag}${memo}`;

      navigator.clipboard
        .writeText(copyText)
        .then(() => {
          alert('クリップボードにコピーしました！');
        })
        .catch((err) => {
          console.error('コピーに失敗しました:', err);
          alert('コピーに失敗しました');
        });
    },
    [currentResults, settings]
  );

  // ログをダウンロード
  const downloadLog = useCallback(() => {
    if (currentResults.length === 0) {
      alert('抽選結果がありません');
      return;
    }

    let logText = `お題ゲームメーカー - 抽選ログ\n`;
    logText += `生成日時: ${new Date().toLocaleString('ja-JP')}\n`;
    logText += `合計お題数: ${currentResults.length}\n`;
    logText += `=======================================\n\n`;

    currentResults.forEach((result, index) => {
      logText += `【お題 ${index + 1}】\n`;
      logText += `${result.text}\n`;
      if (result.memo) {
        logText += `\nメモ・備考:\n${result.memo}\n`;
      }
      logText += `\n---\n\n`;
    });

    logText += `=======================================\n`;
    logText += `${settings.appTitle} - ${settings.streamUrl}\n`;
    logText += `${settings.hashtag}\n`;

    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, -5);
    link.download = `odai_log_${timestamp}.txt`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [currentResults, settings]);

  return {
    data,
    currentResults,
    settings,
    saveSettings,
    drawOneTopic,
    drawMaxTopics,
    redrawTopic,
    updateMemo,
    clearResults,
    copySingleResult,
    downloadLog,
  };
};
