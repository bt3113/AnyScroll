import type { DocKind } from '../../types';

export function detectKind(file: File): DocKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.txt') || name.endsWith('.md')) return 'text';
  return null;
}

// A dynamic import's chunk fetch can fail transiently on a flaky/slow
// connection (surfaces as "Load failed" in Safari, "Failed to fetch
// dynamically imported module" in Chrome) even though the file exists and a
// retry would succeed. Give it a couple of extra tries before giving up.
async function importWithRetry<T>(loader: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await loader();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)));
      }
    }
  }
  throw lastError;
}

// Parsers are dynamically imported so pdf.js/mammoth only load when a
// matching file is actually uploaded, keeping the initial bundle small.
export async function extractText(file: File, kind: DocKind): Promise<string> {
  switch (kind) {
    case 'pdf': {
      const { extractPdfText } = await importWithRetry(() => import('./pdf'));
      return extractPdfText(file);
    }
    case 'docx': {
      const { extractDocxText } = await importWithRetry(() => import('./docx'));
      return extractDocxText(file);
    }
    case 'text': {
      const { extractPlainText } = await importWithRetry(() => import('./text'));
      return extractPlainText(file);
    }
  }
}
