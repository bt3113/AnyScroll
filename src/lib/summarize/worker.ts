import { pipeline } from '@huggingface/transformers';
import type { SummarizeInMessage, WorkerOutMessage } from '../../types';

// The transformers.js pipeline type is deeply generic over task/model id and
// blows up `tsc` ("union type too complex") when narrowed further, so the
// summarizer handle and its call options are kept as `any` at this boundary.
type Summarizer = (text: string, options: Record<string, unknown>) => Promise<unknown>;

const MODEL_ID = 'Xenova/distilbart-cnn-6-6';

let summarizerPromise: Promise<Summarizer> | null = null;

function post(message: WorkerOutMessage) {
  (self as unknown as Worker).postMessage(message);
}

async function withRetries<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (i + 1)));
      }
    }
  }
  throw lastError;
}

async function loadSummarizer(docId: string): Promise<Summarizer> {
  // Cache the in-flight/successful load so multiple chunks share one model
  // instance, but never cache a *failed* load - a transient network error
  // (weak signal, dropped connection while fetching ~50-100MB of weights)
  // would otherwise permanently fail every document for the rest of the tab
  // session, since this promise is reused across uploads.
  if (summarizerPromise) return summarizerPromise;

  // The model is fetched as several files (tokenizer, config, encoder/decoder
  // weights) that download concurrently, each firing its own 0-100 progress
  // event. Reporting any single file's percentage as "the" progress makes the
  // bar jump around; instead track bytes loaded/total per file and report the
  // combined ratio, which only ever increases.
  const fileProgress = new Map<string, { loaded: number; total: number }>();
  let lastReported = 0;

  const onProgress = (info: unknown) => {
    const data = info as { status?: string; file?: string; loaded?: number; total?: number };
    if (data.status !== 'progress' || !data.file || typeof data.total !== 'number' || data.total <= 0) {
      return;
    }
    fileProgress.set(data.file, { loaded: data.loaded ?? 0, total: data.total });

    let loadedSum = 0;
    let totalSum = 0;
    for (const { loaded, total } of fileProgress.values()) {
      loadedSum += loaded;
      totalSum += total;
    }
    const ratio = totalSum > 0 ? loadedSum / totalSum : 0;
    lastReported = Math.max(lastReported, ratio);
    post({ type: 'progress', docId, stage: 'model', progress: lastReported });
  };

  const attempt = (): Promise<Summarizer> =>
    (
      pipeline('summarization', MODEL_ID, {
        dtype: 'q8',
        device: 'webgpu',
        progress_callback: onProgress,
      } as never).catch(() =>
        pipeline('summarization', MODEL_ID, {
          dtype: 'q8',
          device: 'wasm',
          progress_callback: onProgress,
        } as never),
      ) as unknown
    ) as Promise<Summarizer>;

  const promise = withRetries(attempt, 3).catch((err) => {
    summarizerPromise = null;
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Couldn't download the AI model - check your connection and try again. (${detail})`);
  });
  summarizerPromise = promise;
  return promise;
}

function deriveTitle(summary: string): { title: string; body: string } {
  const clean = summary.trim();
  const firstSentenceMatch = clean.match(/[^.!?]+[.!?]?/);
  const first = (firstSentenceMatch?.[0] ?? clean).trim();
  const words = first.split(/\s+/);
  const title = words.slice(0, 8).join(' ').replace(/[.,;:]+$/, '');
  const rest = clean.slice(first.length).trim();
  return { title: title || 'Summary', body: rest || clean };
}

self.addEventListener('message', async (event: MessageEvent<SummarizeInMessage>) => {
  const msg = event.data;
  if (msg.type !== 'summarize') return;
  const { docId, chunks } = msg;

  try {
    const summarizer = await loadSummarizer(docId);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const output = await summarizer(chunk, {
        max_new_tokens: 110,
        min_new_tokens: 24,
        do_sample: false,
      });
      const rawSummary = Array.isArray(output)
        ? (output[0] as { summary_text?: string }).summary_text ?? ''
        : ((output as { summary_text?: string }).summary_text ?? '');

      const { title, body } = deriveTitle(rawSummary);
      post({ type: 'chunk', docId, index: i, title, body });
      post({
        type: 'progress',
        docId,
        stage: 'summarizing',
        progress: (i + 1) / chunks.length,
      });
    }

    post({ type: 'done', docId });
  } catch (err) {
    post({ type: 'error', docId, error: err instanceof Error ? err.message : String(err) });
  }
});
