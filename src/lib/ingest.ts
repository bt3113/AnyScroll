import { detectKind, extractText } from './parse';
import { chunkText, countWords, estimateReadingMinutes } from './summarize/chunk';
import { summarizeDocument } from './summarize/client';
import { putCard, putDoc } from './db';
import type { DocRecord } from '../types';

export class UnsupportedFileError extends Error {}

function titleFromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Untitled';
}

export async function ingestFile(
  file: File,
  onUpdate: (doc: DocRecord) => void,
): Promise<DocRecord> {
  const kind = detectKind(file);
  if (!kind) {
    throw new UnsupportedFileError(`Unsupported file type: ${file.name}`);
  }

  const id = crypto.randomUUID();
  let doc: DocRecord = {
    id,
    title: titleFromFilename(file.name),
    filename: file.name,
    kind,
    status: 'parsing',
    createdAt: Date.now(),
    wordCount: 0,
    readingMinutes: 0,
    cardCount: 0,
    progress: 0,
    archived: false,
    lastOpenedCard: 0,
  };
  await putDoc(doc);
  onUpdate(doc);

  (async () => {
    try {
      const rawText = await extractText(file, kind).catch((err) => {
        const detail = err instanceof Error ? err.message : String(err);
        throw new Error(`Couldn't read the file - check your connection and try again. (${detail})`);
      });
      const words = countWords(rawText);
      const chunks = chunkText(rawText);

      doc = { ...doc, status: 'summarizing', wordCount: words, progress: 0 };
      await putDoc(doc);
      onUpdate(doc);

      let cardCount = 0;
      await summarizeDocument(id, chunks, {
        onProgress: (stage, progress) => {
          const weighted = stage === 'model' ? progress * 0.25 : 0.25 + progress * 0.75;
          doc = { ...doc, progress: weighted };
          onUpdate(doc);
        },
        onCard: async (card) => {
          cardCount += 1;
          await putCard({ ...card, id: `${id}:${card.index}`, docId: id });
          doc = { ...doc, cardCount };
          onUpdate(doc);
        },
      });

      doc = {
        ...doc,
        status: 'ready',
        progress: 1,
        readingMinutes: estimateReadingMinutes(words),
      };
      await putDoc(doc);
      onUpdate(doc);
    } catch (err) {
      doc = {
        ...doc,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      };
      await putDoc(doc);
      onUpdate(doc);
    }
  })();

  return doc;
}
