// Base de datos de apuntes y tarjetas (IndexedDB, dentro del navegador).
//
// Apunte:  { id, title, subject, topic, tags[], kind, source, content, createdAt, updatedAt }
//          kind: 'resumen' | 'comentario' | 'apunte' | 'respuesta'
// Tarjeta: { id, noteId, subject, front, back, box, due, createdAt, reviewedAt }

const DB_NAME = 'apuntes-pau';
const DB_VERSION = 1;
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('cards')) {
          db.createObjectStore('cards', { keyPath: 'id' }).createIndex('noteId', 'noteId');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Cierra otras pestañas de Apuntes PAU y recarga.'));
    });
  }
  return dbPromise;
}

// Ejecuta `fn` dentro de una transacción y devuelve el resultado de la
// petición que devuelva `fn` (si devuelve alguna).
async function run(stores, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    const req = fn(tx);
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Operación cancelada'));
  });
}

function changed() {
  document.dispatchEvent(new CustomEvent('data-changed'));
}

export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// ---------- Apuntes ----------

export async function listNotes() {
  const notes = await run('notes', 'readonly', (tx) => tx.objectStore('notes').getAll());
  return notes.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getNote(id) {
  return run('notes', 'readonly', (tx) => tx.objectStore('notes').get(id));
}

export async function saveNote(data) {
  const now = Date.now();
  const note = {
    title: 'Sin título',
    subject: 'Otra',
    topic: '',
    tags: [],
    kind: 'apunte',
    source: 'manual',
    content: '',
    ...data,
    id: data.id || newId(),
    createdAt: data.createdAt || now,
    updatedAt: now,
  };
  await run('notes', 'readwrite', (tx) => tx.objectStore('notes').put(note));
  changed();
  return note;
}

export async function deleteNote(id) {
  await run(['notes', 'cards'], 'readwrite', (tx) => {
    tx.objectStore('notes').delete(id);
    const cards = tx.objectStore('cards');
    cards.index('noteId').openCursor(IDBKeyRange.only(id)).onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        cards.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
  });
  changed();
}

// ---------- Tarjetas ----------

export function listCards() {
  return run('cards', 'readonly', (tx) => tx.objectStore('cards').getAll());
}

export function cardsForNote(noteId) {
  return run('cards', 'readonly', (tx) => tx.objectStore('cards').index('noteId').getAll(noteId));
}

export async function saveCards(cards) {
  await run('cards', 'readwrite', (tx) => {
    const store = tx.objectStore('cards');
    for (const card of cards) store.put(card);
  });
  changed();
}

export async function deleteCard(id) {
  await run('cards', 'readwrite', (tx) => tx.objectStore('cards').delete(id));
  changed();
}

// ---------- Copia de seguridad ----------

export async function exportData() {
  const [notes, cards] = await Promise.all([listNotes(), listCards()]);
  return { app: 'apuntes-pau', version: 1, exportedAt: new Date().toISOString(), notes, cards };
}

// Añade (o actualiza, si ya existían) los apuntes y tarjetas de una copia.
export async function importData(data) {
  if (!data || data.app !== 'apuntes-pau' || !Array.isArray(data.notes)) {
    throw new Error('Este archivo no es una copia de Apuntes PAU.');
  }
  const notes = data.notes.filter((n) => n && n.id && typeof n.content === 'string');
  const cards = (data.cards || []).filter((c) => c && c.id && c.front);
  await run(['notes', 'cards'], 'readwrite', (tx) => {
    for (const note of notes) tx.objectStore('notes').put(note);
    for (const card of cards) tx.objectStore('cards').put(card);
  });
  changed();
  return { notes: notes.length, cards: cards.length };
}
