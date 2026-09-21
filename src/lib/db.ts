import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CardRecord, DocRecord } from '../types';

interface AnyScrollDB extends DBSchema {
  documents: {
    key: string;
    value: DocRecord;
    indexes: { 'by-createdAt': number };
  };
  cards: {
    key: string;
    value: CardRecord;
    indexes: { 'by-docId': string };
  };
}

let dbPromise: Promise<IDBPDatabase<AnyScrollDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<AnyScrollDB>('anyscroll', 1, {
      upgrade(db) {
        const docs = db.createObjectStore('documents', { keyPath: 'id' });
        docs.createIndex('by-createdAt', 'createdAt');
        const cards = db.createObjectStore('cards', { keyPath: 'id' });
        cards.createIndex('by-docId', 'docId');
      },
    });
  }
  return dbPromise;
}

export async function putDoc(doc: DocRecord) {
  const db = await getDb();
  await db.put('documents', doc);
}

export async function getDoc(id: string) {
  const db = await getDb();
  return db.get('documents', id);
}

export async function deleteDoc(id: string) {
  const db = await getDb();
  const tx = db.transaction(['documents', 'cards'], 'readwrite');
  await tx.objectStore('documents').delete(id);
  const cardIndex = tx.objectStore('cards').index('by-docId');
  let cursor = await cardIndex.openCursor(IDBKeyRange.only(id));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function listDocs() {
  const db = await getDb();
  const all = await db.getAllFromIndex('documents', 'by-createdAt');
  return all.reverse();
}

export async function putCard(card: CardRecord) {
  const db = await getDb();
  await db.put('cards', card);
}

export async function listCards(docId: string) {
  const db = await getDb();
  const all = await db.getAllFromIndex('cards', 'by-docId', docId);
  return all.sort((a, b) => a.index - b.index);
}
