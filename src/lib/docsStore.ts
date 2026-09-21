import { useSyncExternalStore } from 'react';
import { listDocs, putDoc as dbPutDoc, deleteDoc as dbDeleteDoc } from './db';
import type { DocRecord } from '../types';

let docs: DocRecord[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function upsert(doc: DocRecord) {
  const idx = docs.findIndex((d) => d.id === doc.id);
  if (idx === -1) {
    docs = [doc, ...docs];
  } else {
    docs = docs.map((d, i) => (i === idx ? doc : d));
  }
  docs = [...docs].sort((a, b) => b.createdAt - a.createdAt);
  emit();
}

export async function initDocsStore() {
  const loaded = await listDocs();

  // A parsing/summarizing job only exists in memory. If the page was reloaded,
  // Safari killed the tab, or a previous worker hung, that job cannot still be
  // running. Convert those stale records to an explicit error so the UI never
  // shows "Converting… 0%" forever after a refresh.
  const repaired = await Promise.all(
    loaded.map(async (doc): Promise<DocRecord> => {
      if (doc.status !== 'parsing' && doc.status !== 'summarizing') return doc;

      const failed: DocRecord = {
        ...doc,
        status: 'error',
        progress: 0,
        error: 'Processing was interrupted. Please upload the file again.',
      };
      await dbPutDoc(failed);
      return failed;
    }),
  );

  docs = repaired;
  emit();
}

export function reportDocUpdate(doc: DocRecord) {
  upsert(doc);
}

export async function persistDoc(doc: DocRecord) {
  await dbPutDoc(doc);
  upsert(doc);
}

export async function removeDoc(id: string) {
  await dbDeleteDoc(id);
  docs = docs.filter((d) => d.id !== id);
  emit();
}

export function useDocs(): DocRecord[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => docs,
  );
}
