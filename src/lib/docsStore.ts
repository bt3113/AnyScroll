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
  docs = await listDocs();
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
