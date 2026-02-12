import { GameData, Topic } from '../types';

// 重み付きランダム選択
export const weightedRandomSelect = <T extends { rare: number }>(
  items: T[]
): T | null => {
  if (!items || items.length === 0) return null;

  const weights = items.map((item) => {
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

  return items[0];
};

// お題を生成
export const generateTopic = (data: GameData): Topic | null => {
  if (!data || !data.initial || !data.words) {
    console.error('データが読み込まれていません');
    return null;
  }

  const initial = weightedRandomSelect(data.initial);
  const word = weightedRandomSelect(data.words);

  if (!initial || !word) {
    return null;
  }

  // 低確率（10%）で逆回答モード
  const isReverse = Math.random() < 0.1;

  let wordText: string;
  if (isReverse) {
    wordText = word.not;
  } else {
    wordText = Math.random() < 0.5 ? word.normal : word.not;
  }

  return {
    text: `「${initial.key}」から始まる「${wordText}」といえば？`,
    isReverse: isReverse,
  };
};
