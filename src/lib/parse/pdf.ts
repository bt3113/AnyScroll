import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let currentLine: string[] = [];

    const flushLine = () => {
      const line = currentLine.join(' ').replace(/\s+/g, ' ').trim();
      if (line) lines.push(line);
      currentLine = [];
    };

    for (const item of content.items) {
      if (!('str' in item)) continue;
      const value = item.str.trim();
      if (value) currentLine.push(value);
      if (item.hasEOL) flushLine();
    }
    flushLine();

    pages.push(lines.join('\n'));
  }

  return pages.join('\n\n');
}
