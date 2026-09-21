export type DocKind = 'pdf' | 'docx' | 'text';

export type DocStatus = 'parsing' | 'summarizing' | 'ready' | 'error';

export type CardVisualType = 'flow' | 'steps' | 'timeline' | 'compare' | 'hub';

export interface CardVisualNode {
  label: string;
  detail: string;
}

export interface CardVisual {
  type: CardVisualType;
  title?: string;
  nodes: CardVisualNode[];
}

export interface CardInteraction {
  prompt: string;
  answer: string;
}

export interface DocRecord {
  id: string;
  title: string;
  filename: string;
  kind: DocKind;
  status: DocStatus;
  createdAt: number;
  wordCount: number;
  readingMinutes: number;
  cardCount: number;
  progress: number; // 0..1
  archived: boolean;
  lastOpenedCard: number;
  error?: string;
}

export interface CardRecord {
  id: string;
  docId: string;
  index: number;
  title: string;
  body: string;
  accent: number;
  keyPoints?: string[];
  visual?: CardVisual;
  interaction?: CardInteraction;
}

export interface SummarizeProgressMessage {
  type: 'progress';
  docId: string;
  stage: 'model' | 'summarizing';
  progress: number; // 0..1
}

export interface SummarizeChunkMessage {
  type: 'chunk';
  docId: string;
  index: number;
  title: string;
  body: string;
  keyPoints?: string[];
  visual?: CardVisual;
  interaction?: CardInteraction;
}

export interface SummarizeDoneMessage {
  type: 'done';
  docId: string;
}

export interface SummarizeErrorMessage {
  type: 'error';
  docId: string;
  error: string;
}

export type WorkerOutMessage =
  | SummarizeProgressMessage
  | SummarizeChunkMessage
  | SummarizeDoneMessage
  | SummarizeErrorMessage;

export interface SummarizeInMessage {
  type: 'summarize';
  docId: string;
  chunks: string[];
}
