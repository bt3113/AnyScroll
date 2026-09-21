import { pipeline, env } from '@huggingface/transformers';
import type { SummarizeInMessage, WorkerOutMessage } from '../../types';

// The transformers.js pipeline type is deeply generic over task/model id and
// blows up `tsc` ("union type too complex") when narrowed further, so the
// summarizer handle and its call options are kept as `any` at this boundary.
type Summarizer = (text: string, options: Record<string, unknown>) => Promise<unknown>;

const MODEL_ID = 'Xenova/distilbart-cnn-6-6';

// GitHub Pages cannot set the cross-origin isolation headers required by the
// multi-threaded ONNX/WASM backend. Single-threaded WASM is slower but works
// without SharedArrayBuffer and avoids the known inference deadlock.
(env as { backends: { onnx: { wasm: { numThreads: number } } } }).backends.onnx.wasm.numThreads = 1;

const MODEL_LOAD_TIMEOUT_MS = 30_000;
const CHUNK_TIMEOUT_MS = 90_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

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

function isMobileDevice(): boolean {
  const ua = self.navigator?.userAgent ?? '';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

async function loadSummarizer(docId: string): Promise<Summarizer> {
  if (summarizerPromise) return summarizerPromise;

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
    throw err;
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

function summarizeLocally(text: string): { title: string; body: string } {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return { title: 'Summary', body: 'No readable text found in this section.' };

  const sentences = (normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [normalized])
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const meaningful = sentences.filter((sentence) => sentence.split(/\s+/).length >= 6);
  const source = meaningful.length > 0 ? meaningful : sentences;
  const indexes =
    source.length <= 3
      ? source.map((_, index) => index)
      : [0, Math.floor((source.length - 1) / 2), source.length - 1];

  const selected = Array.from(new Set(indexes)).map((index) => source[index]);
  const summary = selected.join(' ').slice(0, 1200);
  return deriveTitle(summary);
}

async function runLocalFallback(docId: string, chunks: string[], startIndex = 0): Promise<void> {
  post({ type: 'progress', docId, stage: 'model', progress: 1 });

  for (let i = startIndex; i < chunks.length; i++) {
    const { title, body } = summarizeLocally(chunks[i]);
    post({ type: 'chunk', docId, index: i, title, body });
    post({
      type: 'progress',
      docId,
      stage: 'summarizing',
      progress: (i + 1) / chunks.length,
    });
    await Promise.resolve();
  }
}

self.addEventListener('message', async (event: MessageEvent<SummarizeInMessage>) => {
  const msg = event.data;
  if (msg.type !== 'summarize') return;
  const { docId, chunks } = msg;

  try {
    // Mobile Safari is the environment where the model path has repeatedly
    // stalled at 0%/25%. Use an instant deterministic fallback there rather
    // than downloading and compiling a large ONNX model on the phone.
    if (isMobileDevice()) {
      await runLocalFallback(docId, chunks);
      post({ type: 'done', docId });
      return;
    }

    let summarizer: Summarizer;
    try {
      summarizer = await withTimeout(
        loadSummarizer(docId),
        MODEL_LOAD_TIMEOUT_MS,
        'AI model loading timed out.',
      );
    } catch {
      // The app should still work if model hosting, WebGPU, WASM compilation,
      // or a flaky connection prevents the optional AI model from loading.
      await runLocalFallback(docId, chunks);
      post({ type: 'done', docId });
      return;
    }

    for (let i = 0; i < chunks.length; i++) {
      try {
        const output = await withTimeout(
          summarizer(chunks[i], {
            max_new_tokens: 110,
            min_new_tokens: 24,
            do_sample: false,
          }),
          CHUNK_TIMEOUT_MS,
          `Summarizing timed out on part ${i + 1} of ${chunks.length}.`,
        );
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
      } catch {
        // If inference itself fails or hangs, finish the remaining cards with
        // the local fallback rather than leaving the document permanently stuck.
        await runLocalFallback(docId, chunks, i);
        break;
      }
    }

    post({ type: 'done', docId });
  } catch (err) {
    post({ type: 'error', docId, error: err instanceof Error ? err.message : String(err) });
  }
});
