export type Gender = '남성' | '여성' | '기타';
export type KeywordKey = 'hiding' | 'pain' | 'wish';

export interface Book {
  id: string;
  title: string;
  author: string;
  coverImage: string;
  synopsis: string;
  character: {
    name: string;
    age: number;
    gender: Gender;
    setting: string;
    personality: string;
    voice: string;
  };
  answers: Record<KeywordKey, string>;
  excerpt: string;
}

export interface ChatMessage {
  role: 'player' | 'character';
  content: string;
}

export interface ChatRequest {
  bookId: string;
  player: { name: string; age: number; gender: Gender };
  messages: ChatMessage[];
  turn: number;
}

export interface EvaluationRequest {
  bookId: string;
  messages: ChatMessage[];
}

export interface EvaluationResult {
  discovered: Record<KeywordKey, boolean>;
  success: boolean;
}
