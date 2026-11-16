/**
 * Card Maker — persistência local em IndexedDB.
 * Cartas ficam em "cards" (dados completos, com arte) e um índice leve em "index"
 * (miniatura + metadados) para a biblioteca abrir rápido.
 */
import { CardIndexEntry, CustomCard, cloneCard, createBlankCard, toIndexEntry } from './model';

const DB_NAME = 'proliferate-card-maker';
const DB_VERSION = 2;
const STORE_CARDS = 'cards';
const STORE_INDEX = 'index';
const STORE_ASSETS = 'assets';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CARDS)) db.createObjectStore(STORE_CARDS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_INDEX)) db.createObjectStore(STORE_INDEX, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_ASSETS)) db.createObjectStore(STORE_ASSETS, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Falha ao abrir o banco local'));
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function listCardIndex(): Promise<CardIndexEntry[]> {
  const db = await openDb();
  const tx = db.transaction(STORE_INDEX, 'readonly');
  const all = await wrap<CardIndexEntry[]>(tx.objectStore(STORE_INDEX).getAll());
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getCard(id: string): Promise<CustomCard | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_CARDS, 'readonly');
  const card = await wrap<CustomCard | undefined>(tx.objectStore(STORE_CARDS).get(id));
  return card ? normalizeCard(card) : null;
}

export async function saveCard(card: CustomCard, thumb: string): Promise<CardIndexEntry> {
  const db = await openDb();
  const entry = toIndexEntry(card, thumb);
  const tx = db.transaction([STORE_CARDS, STORE_INDEX], 'readwrite');
  tx.objectStore(STORE_CARDS).put(card);
  tx.objectStore(STORE_INDEX).put(entry);
  await txDone(tx);
  return entry;
}

export async function deleteCards(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDb();
  const tx = db.transaction([STORE_CARDS, STORE_INDEX], 'readwrite');
  ids.forEach((id) => {
    tx.objectStore(STORE_CARDS).delete(id);
    tx.objectStore(STORE_INDEX).delete(id);
  });
  await txDone(tx);
}

export async function getCards(ids: string[]): Promise<CustomCard[]> {
  const out: CustomCard[] = [];
  for (const id of ids) {
    const c = await getCard(id);
    if (c) out.push(c);
  }
  return out;
}

/** Garante que cartas antigas/importadas tenham todos os campos atuais. */
export function normalizeCard(raw: CustomCard): CustomCard {
  const base = createBlankCard();
  const faces = Array.isArray(raw.faces) && raw.faces.length > 0 ? raw.faces : base.faces;
  const faceBase = base.faces[0];
  return {
    ...raw,
    version: 1,
    createdAt: raw.createdAt || base.createdAt,
    updatedAt: raw.updatedAt || base.updatedAt,
    meta: { ...base.meta, ...(raw.meta || {}) },
    faces: faces.slice(0, 2).map((f) => ({
      ...faceBase,
      ...f,
      art: { ...faceBase.art, ...(f.art || {}) },
      abilities: Array.isArray(f.abilities) ? f.abilities : [],
      chapters: Array.isArray(f.chapters) ? f.chapters : [],
      colors: Array.isArray(f.colors) ? f.colors : [],
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Projeto (arquivo .json) — exportar / importar                        */
/* ------------------------------------------------------------------ */

export interface CardMakerProjectFile {
  app: 'proliferate-card-maker';
  version: 1;
  exportedAt: string;
  cards: CustomCard[];
}

export function buildProjectFile(cards: CustomCard[]): CardMakerProjectFile {
  return { app: 'proliferate-card-maker', version: 1, exportedAt: new Date().toISOString(), cards };
}

export function parseProjectFile(text: string): CustomCard[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('O arquivo não é um JSON válido.');
  }
  const obj = parsed as Partial<CardMakerProjectFile> & Partial<CustomCard>;
  let cards: CustomCard[] = [];
  if (obj && obj.app === 'proliferate-card-maker' && Array.isArray(obj.cards)) cards = obj.cards;
  else if (obj && Array.isArray((obj as { faces?: unknown }).faces)) cards = [obj as CustomCard];
  else throw new Error('Arquivo não reconhecido como projeto do Card Maker.');
  return cards.map((c) => cloneCard(normalizeCard(c), true));
}

/* ------------------------------------------------------------------ */
/* Biblioteca de fontes e frames próprios do usuário                    */
/* ------------------------------------------------------------------ */

export type AssetKind = 'font' | 'frame';

export interface UserAsset {
  id: string;
  kind: AssetKind;
  name: string;
  /** data: URL do arquivo (fonte ou imagem) */
  data: string;
  createdAt: string;
}

export async function listAssets(kind?: AssetKind): Promise<UserAsset[]> {
  const db = await openDb();
  const all = await wrap<UserAsset[]>(db.transaction(STORE_ASSETS, 'readonly').objectStore(STORE_ASSETS).getAll());
  return all.filter((a) => !kind || a.kind === kind).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export async function getAsset(id: string): Promise<UserAsset | null> {
  const db = await openDb();
  const a = await wrap<UserAsset | undefined>(db.transaction(STORE_ASSETS, 'readonly').objectStore(STORE_ASSETS).get(id));
  return a || null;
}

export async function saveAsset(asset: UserAsset): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_ASSETS, 'readwrite');
  tx.objectStore(STORE_ASSETS).put(asset);
  await txDone(tx);
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_ASSETS, 'readwrite');
  tx.objectStore(STORE_ASSETS).delete(id);
  await txDone(tx);
}
