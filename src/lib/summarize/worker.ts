import { pipeline, env } from '@huggingface/transformers';
import type {
  CardInteraction,
  CardVisual,
  CardVisualNode,
  SummarizeInMessage,
  WorkerOutMessage,
} from '../../types';

type Summarizer = (text: string, options: Record<string, unknown>) => Promise<unknown>;

const MODEL_ID = 'Xenova/distilbart-cnn-6-6';

// GitHub Pages cannot set the cross-origin isolation headers required by the
// multi-threaded ONNX/WASM backend. Single-threaded WASM works without them.
(env as { backends: { onnx: { wasm: { numThreads: number } } } }).backends.onnx.wasm.numThreads = 1;

const MODEL_LOAD_TIMEOUT_MS = 30_000;
const CHUNK_TIMEOUT_MS = 90_000;
const MAX_POINTS = 4;

const STOPWORDS = new Set(
  'a an and are as at be because been but by can could did do does for from had has have he her hers him his how i if in into is it its may might more most not of on one or our ours she should so some than that the their theirs them then there these they this those to too up us was we were what when where which while who why will with would you your yours'.split(
    ' ',
  ),
);

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

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function cleanHeading(value: string): string {
  return value
    .replace(/^##\s*/, '')
    .replace(/\s+\d+(?:\s+\d+)+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHeading(text: string): string | undefined {
  const line = text
    .split('\n')
    .map((value) => value.trim())
    .find((value) => value.startsWith('## '));
  return line ? cleanHeading(line) : undefined;
}

function sourceWithoutHeading(text: string): string {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('## '))
    .join('\n')
    .trim();
}

function splitSentences(text: string): string[] {
  return (normalizeText(text).match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [])
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.split(/\s+/).length >= 5);
}

function contentWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z'’-]{2,}/g) ?? []).filter((word) => !STOPWORDS.has(word));
}

function similarity(a: string, b: string): number {
  const left = new Set(contentWords(a));
  const right = new Set(contentWords(b));
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const word of left) if (right.has(word)) overlap += 1;
  return overlap / Math.min(left.size, right.size);
}

function salientSentences(text: string, max = MAX_POINTS): string[] {
  const sentences = splitSentences(text);
  if (sentences.length <= max) return sentences;

  const frequencies = new Map<string, number>();
  for (const word of contentWords(text)) frequencies.set(word, (frequencies.get(word) ?? 0) + 1);

  const scored = sentences.map((sentence, index) => {
    const words = contentWords(sentence);
    const signal = words.reduce((sum, word) => sum + Math.log2(2 + (frequencies.get(word) ?? 0)), 0);
    const density = signal / Math.sqrt(Math.max(words.length, 1));
    const positionBonus = index === 0 ? 0.35 : index < Math.ceil(sentences.length * 0.25) ? 0.12 : 0;
    return { sentence, index, score: density + positionBonus };
  });

  scored.sort((a, b) => b.score - a.score);
  const selected: typeof scored = [];
  for (const candidate of scored) {
    if (selected.every((item) => similarity(item.sentence, candidate.sentence) < 0.72)) {
      selected.push(candidate);
    }
    if (selected.length >= max) break;
  }

  return selected.sort((a, b) => a.index - b.index).map((item) => item.sentence);
}

function extractListItems(text: string): string[] {
  const items: string[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    const match = line.match(/^(?:[-*•▪◦]|\d+[.)]|[A-Za-z][.)])\s+(.+)$/);
    if (match?.[1]) items.push(match[1].trim());
  }

  return Array.from(new Set(items.map(normalizeText))).filter((item) => item.split(/\s+/).length >= 2);
}

function shorten(text: string, maxWords = 24): string {
  const clean = normalizeText(text).replace(/^[-*•▪◦]\s*/, '');
  const words = clean.split(/\s+/);
  return words.length <= maxWords ? clean : `${words.slice(0, maxWords).join(' ')}…`;
}

function shortLabel(text: string): string {
  const clean = shorten(text, 8).replace(/[.!?;:,]+$/, '');
  return clean.length > 54 ? `${clean.slice(0, 51).trim()}…` : clean;
}

function deriveTitle(summary: string): string {
  const clean = normalizeText(summary);
  const first = (clean.match(/[^.!?]+[.!?]?/)?.[0] ?? clean).trim();
  const words = first.split(/\s+/).filter(Boolean);
  return words.slice(0, 8).join(' ').replace(/[.,;:!?]+$/, '') || 'Key idea';
}

function uniquePoints(points: string[]): string[] {
  const output: string[] = [];
  for (const point of points) {
    const clean = shorten(point, 24);
    if (!clean || output.some((existing) => similarity(existing, clean) > 0.82)) continue;
    output.push(clean);
    if (output.length >= MAX_POINTS) break;
  }
  return output;
}

function buildNodes(points: string[]): CardVisualNode[] {
  return points.slice(0, 4).map((point) => ({ label: shortLabel(point), detail: point }));
}

function buildVisual(source: string, keyPoints: string[], listItems: string[]): CardVisual | undefined {
  const years = Array.from(new Set(source.match(/\b(?:19|20)\d{2}\b/g) ?? []));
  if (years.length >= 2) {
    const sentences = splitSentences(source);
    const nodes = years
      .map((year) => {
        const detail = sentences.find((sentence) => sentence.includes(year));
        return detail ? { label: year, detail: shorten(detail, 28) } : undefined;
      })
      .filter((node): node is CardVisualNode => Boolean(node))
      .slice(0, 4);
    if (nodes.length >= 2) return { type: 'timeline', title: 'Timeline', nodes };
  }

  const sequenceCues = source.match(/\b(first|second|third|next|then|after|before|finally|stage|step|process|workflow|leads to|results in|therefore)\b/gi) ?? [];
  if (listItems.length >= 3 && sequenceCues.length >= 1) {
    return { type: 'steps', title: 'How it works', nodes: buildNodes(listItems) };
  }

  const comparisonCues = source.match(/\b(whereas|versus|compared (?:to|with)|in contrast|on the other hand|difference between)\b/gi) ?? [];
  if (comparisonCues.length >= 1 && keyPoints.length >= 2) {
    return { type: 'compare', title: 'Key contrast', nodes: buildNodes(keyPoints.slice(0, 2)) };
  }

  if (sequenceCues.length >= 2 && keyPoints.length >= 3) {
    return { type: 'flow', title: 'Flow', nodes: buildNodes(keyPoints) };
  }

  if (keyPoints.length >= 3) {
    return { type: 'hub', title: 'At a glance', nodes: buildNodes(keyPoints) };
  }

  return undefined;
}

function buildInteraction(title: string, visual: CardVisual | undefined, keyPoints: string[]): CardInteraction | undefined {
  if (!keyPoints.length) return undefined;

  if (visual?.type === 'steps' || visual?.type === 'flow') {
    return {
      prompt: 'Can you reconstruct the sequence before revealing it?',
      answer: keyPoints.join(' → '),
    };
  }

  if (visual?.type === 'compare') {
    return {
      prompt: 'What distinction is this card asking you to remember?',
      answer: keyPoints.slice(0, 2).join(' ↔ '),
    };
  }

  return {
    prompt: `What is the main takeaway from “${title}”?`,
    answer: keyPoints[0],
  };
}

function buildStructuredCard(source: string, generatedSummary?: string) {
  const heading = extractHeading(source);
  const cleanSource = sourceWithoutHeading(source);
  const listItems = extractListItems(cleanSource);
  const salient = salientSentences(cleanSource, MAX_POINTS);
  const points = uniquePoints(listItems.length >= 3 ? [...listItems, ...salient] : salient);

  const extractiveBody = salient.slice(0, 3).join(' ');
  const generatedBody = generatedSummary ? normalizeText(generatedSummary) : '';
  const body = shorten(generatedBody || extractiveBody || cleanSource, 90);
  const title = heading || deriveTitle(generatedBody || extractiveBody || cleanSource);
  const visual = buildVisual(cleanSource, points, listItems);
  const interaction = buildInteraction(title, visual, points);

  return { title, body, keyPoints: points, visual, interaction };
}

async function runLocalFallback(docId: string, chunks: string[], startIndex = 0): Promise<void> {
  post({ type: 'progress', docId, stage: 'model', progress: 1 });

  for (let i = startIndex; i < chunks.length; i++) {
    const card = buildStructuredCard(chunks[i]);
    post({ type: 'chunk', docId, index: i, ...card });
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
    // Mobile avoids a large ONNX model download, but still gets a structured,
    // source-grounded extractive summary with diagrams and recall prompts.
    if (isMobileDevice()) {
      await runLocalFallback(docId, chunks);
      post({ type: 'done', docId });
      return;
    }

    let summarizer: Summarizer;
    try {
      summarizer = await withTimeout(loadSummarizer(docId), MODEL_LOAD_TIMEOUT_MS, 'AI model loading timed out.');
    } catch {
      await runLocalFallback(docId, chunks);
      post({ type: 'done', docId });
      return;
    }

    for (let i = 0; i < chunks.length; i++) {
      try {
        const modelInput = chunks[i]
          .replace(/^##\s*/gm, '')
          .replace(/^(?:[-*•▪◦]|\d+[.)])\s+/gm, '')
          .replace(/\s+/g, ' ')
          .trim();
        const output = await withTimeout(
          summarizer(modelInput, {
            max_new_tokens: 150,
            min_new_tokens: 42,
            do_sample: false,
          }),
          CHUNK_TIMEOUT_MS,
          `Summarizing timed out on part ${i + 1} of ${chunks.length}.`,
        );
        const rawSummary = Array.isArray(output)
          ? (output[0] as { summary_text?: string }).summary_text ?? ''
          : ((output as { summary_text?: string }).summary_text ?? '');

        const card = buildStructuredCard(chunks[i], rawSummary);
        post({ type: 'chunk', docId, index: i, ...card });
        post({
          type: 'progress',
          docId,
          stage: 'summarizing',
          progress: (i + 1) / chunks.length,
        });
      } catch {
        await runLocalFallback(docId, chunks, i);
        break;
      }
    }

    post({ type: 'done', docId });
  } catch (err) {
    post({ type: 'error', docId, error: err instanceof Error ? err.message : String(err) });
  }
});
