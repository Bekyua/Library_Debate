export type DebateSide = 'pro' | 'con';
export type StageKey = 'opening' | 'cardSelection' | 'rebuttal' | 'final';

export interface DebateStage {
  key: StageKey;
  label: string;
  durationSeconds: number;
  sideOrder: DebateSide[];
}

export type CardType = 'defense' | 'reduce' | 'extend';

export interface DebateCard {
  id: string;
  type: CardType;
  label: string;
  description: string;
  used: boolean;
}

export interface ChatMessage {
  id: string;
  side: DebateSide | 'user';
  content: string;
  timestamp: string;
}

export interface DebateBook {
  id: string;
  title: string;
  author: string;
  summary: string;
}

export interface JudgeScore {
  logicStructure: number;
  consistency: number;
  evidenceAccuracy: number;
  summary: string;
  aggregateScore?: number;
  winner?: 'user' | 'ai' | 'draw';
}
