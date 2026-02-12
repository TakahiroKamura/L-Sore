export interface InitialChar {
  key: string;
  rare: number;
}

export interface Word {
  normal: string;
  not: string;
  rare: number;
}

export interface GameData {
  initial: InitialChar[];
  words: Word[];
}

export interface Topic {
  text: string;
  isReverse: boolean;
}

export interface DrawResult {
  id: number;
  text: string;
  isReverse: boolean;
  memo: string;
  drawnAt: Date;
}

export interface Settings {
  appTitle: string;
  streamUrl: string;
  hashtag: string;
}
