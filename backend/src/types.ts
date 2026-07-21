export type DebateSide = 'pro' | 'con';

export interface AiResponseRequest {
  position: DebateSide;
  history: string[];
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
}
