import type { DocKind } from '../../types';

export function detectKind(file: File): DocKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.txt') || name.endsWith('.md')) return 'text';
  return null;
}

// Parsers are dynamically imported so pdf.js/mammoth only load when a
// matching file is actually uploaded, keeping the initial bundle small.
export async function extractText(file: File, kind: DocKind): Promise<string> {
  switch (kind) {
    case 'pdf': {
      const { extractPdfText } = await import('./pdf');
      return extractPdfText(file);
    }
    case 'docx': {
      const { extractDocxText } = await import('./docx');
      return extractDocxText(file);
    }
    case 'text': {
      const { extractPlainText } = await import('./text');
      return extractPlainText(file);
    }
  }
}
