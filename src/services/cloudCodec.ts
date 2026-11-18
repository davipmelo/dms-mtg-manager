/**
 * Codec do documento de sincronização na nuvem.
 *
 * O Firestore limita cada documento a ~1 MiB. Para caber o máximo possível:
 *  1. Imagens embutidas (data URLs de artes personalizadas) são deduplicadas: a mesma
 *     imagem aparece em coleção, decks, proxies, imageUrl/imageUrlLarge... e passa a
 *     ser guardada uma única vez em `assets`, com referências curtas no lugar.
 *  2. O JSON resultante é comprimido com gzip e guardado como bytes (sem base64).
 *  3. Se ainda assim passar do limite de um documento, os bytes são divididos em partes.
 */

export const CLOUD_FORMAT = 'gz2';
/** Espaço útil para os bytes num único documento (deixa folga para os metadados). */
export const SINGLE_DOC_MAX_BYTES = 1_000_000;
/** Tamanho de cada parte quando o conteúdo precisa ser dividido. */
export const CHUNK_BYTES = 950_000;
/** Teto total (um lote do Firestore aceita até ~10 MiB). */
export const MAX_TOTAL_BYTES = 9_000_000;

const ASSET_PREFIX = '@asset:';

interface AssetEnvelope<T> {
  v: 1;
  assets: string[];
  data: T;
}

/** Substitui data URLs repetidas por referências `@asset:N`. */
export function extractAssets<T>(data: T): AssetEnvelope<T> {
  const assets: string[] = [];
  const index = new Map<string, number>();
  const json = JSON.stringify(data, (_key, value) => {
    if (typeof value === 'string' && value.startsWith('data:')) {
      let i = index.get(value);
      if (i === undefined) {
        i = assets.length;
        assets.push(value);
        index.set(value, i);
      }
      return `${ASSET_PREFIX}${i}`;
    }
    return value;
  });
  return { v: 1, assets, data: JSON.parse(json) as T };
}

/** Restaura as data URLs a partir das referências `@asset:N`. */
export function restoreAssets<T>(envelope: AssetEnvelope<T>): T {
  const { assets } = envelope;
  if (!assets || assets.length === 0) return envelope.data;
  const json = JSON.stringify(envelope.data);
  return JSON.parse(json, (_key, value) => {
    if (typeof value === 'string' && value.startsWith(ASSET_PREFIX)) {
      const i = Number(value.slice(ASSET_PREFIX.length));
      return Number.isInteger(i) && assets[i] !== undefined ? assets[i] : value;
    }
    return value;
  }) as T;
}

export function canCompress(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

async function pipeBytes(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function gzipBytes(text: string): Promise<Uint8Array> {
  return pipeBytes(new TextEncoder().encode(text), new CompressionStream('gzip'));
}

export async function gunzipBytes(bytes: Uint8Array): Promise<string> {
  return new TextDecoder().decode(await pipeBytes(bytes, new DecompressionStream('gzip')));
}

/** Serializa e comprime um payload completo. */
export async function encodeCloudData<T>(data: T): Promise<Uint8Array> {
  return gzipBytes(JSON.stringify(extractAssets(data)));
}

/** Descomprime e restaura um payload completo. */
export async function decodeCloudData<T>(bytes: Uint8Array): Promise<T> {
  const parsed = JSON.parse(await gunzipBytes(bytes));
  if (parsed && parsed.v === 1 && Array.isArray(parsed.assets) && 'data' in parsed) {
    return restoreAssets(parsed as AssetEnvelope<T>);
  }
  return parsed as T;
}

export function splitBytes(bytes: Uint8Array, size = CHUNK_BYTES): Uint8Array[] {
  const parts: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += size) parts.push(bytes.slice(i, i + size));
  return parts.length > 0 ? parts : [new Uint8Array()];
}

export function joinBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** Hash curto (FNV-1a) para detectar que nada mudou e evitar gravações repetidas. */
export function hashBytes(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(16)}-${bytes.length}`;
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
