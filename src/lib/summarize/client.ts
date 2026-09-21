import type { CardRecord, WorkerOutMessage } from '../../types';

export interface SummarizeCallbacks {
  onProgress: (stage: 'model' | 'summarizing', progress: number) => void;
  onCard: (card: Omit<CardRecord, 'id' | 'docId'>) => void;
}

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  }
  return worker;
}

const ACCENT_COUNT = 6;

export function summarizeDocument(
  docId: string,
  chunks: string[],
  callbacks: SummarizeCallbacks,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = getWorker();

    const handleMessage = (event: MessageEvent<WorkerOutMessage>) => {
      const msg = event.data;
      if (msg.docId !== docId) return;

      if (msg.type === 'progress') {
        callbacks.onProgress(msg.stage, msg.progress);
      } else if (msg.type === 'chunk') {
        callbacks.onCard({
          index: msg.index,
          title: msg.title,
          body: msg.body,
          keyPoints: msg.keyPoints,
          visual: msg.visual,
          interaction: msg.interaction,
          accent: msg.index % ACCENT_COUNT,
        });
      } else if (msg.type === 'done') {
        w.removeEventListener('message', handleMessage);
        resolve();
      } else if (msg.type === 'error') {
        w.removeEventListener('message', handleMessage);
        reject(new Error(msg.error));
      }
    };

    w.addEventListener('message', handleMessage);
    w.postMessage({ type: 'summarize', docId, chunks });
  });
}
