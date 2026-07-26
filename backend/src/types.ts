export type DebateSide = 'pro' | 'con';

export interface AiResponseRequest {
  position: DebateSide;
  history: string[];
  stage?: 'opening' | 'cardSelection' | 'rebuttal' | 'final';
  book?: string;
}

export interface AiResponse {
  response: string;
}

export interface JudgeRequest {
  messages: Array<{ side: DebateSide | 'user'; content: string }>;
  book?: string;
}

export interface JudgeResult {
  logicStructure: number;
  consistency: number;
  evidenceAccuracy: number;
  summary: string;
  // Aggregate score computed as weighted average (logicStructure 40%, consistency 30%, evidenceAccuracy 30%)
  aggregateScore?: number;
  // Winner according to user-centric threshold rule: 'user' | 'ai' | 'draw'
  winner?: 'user' | 'ai' | 'draw';
}
