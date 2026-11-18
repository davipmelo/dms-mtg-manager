import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { UserProfile, CloudUserData, CollectionItem, Deck, ProxyItem, Card, DeckTag } from '../types';
import { compressDataUrlIfNeeded } from './imageUtils';
import {
  CLOUD_FORMAT,
  SINGLE_DOC_MAX_BYTES,
  CHUNK_BYTES,
  MAX_TOTAL_BYTES,
  canCompress,
  encodeCloudData,
  decodeCloudData,
  gunzipBytes,
  base64ToBytes,
  splitBytes,
  joinBytes,
  hashBytes,
} from './cloudCodec';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

const STORAGE_KEY_SIMULATED_USERS = 'dms_mtg_simulated_users_v1';
const STORAGE_KEY_SIMULATED_SESSION = 'dms_mtg_simulated_session_v1';
const STORAGE_KEY_SIMULATED_CLOUD_DATA = 'dms_mtg_simulated_cloud_v1';

export function getActiveFirebaseConfig(): FirebaseConfig | null {
  const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

  if (envApiKey && envProjectId) {
    return {
      apiKey: envApiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${envProjectId}.firebaseapp.com`,
      projectId: envProjectId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    };
  }

  return null;
}

export function isFirebaseConfigured(): boolean {
  return getActiveFirebaseConfig() !== null;
}

interface FirebaseSdk {
  app: typeof import('firebase/app');
  auth: typeof import('firebase/auth');
  fs: typeof import('firebase/firestore');
}
interface FirebaseInstances {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  sdk: FirebaseSdk;
}

// O SDK do Firebase (~700 KB) só é baixado quando há configuração e alguém precisa dele.
let instancesPromise: Promise<FirebaseInstances | null> | null = null;

function getFirebaseInstances(): Promise<FirebaseInstances | null> {
  const config = getActiveFirebaseConfig();
  if (!config) return Promise.resolve(null);
  if (!instancesPromise) {
    instancesPromise = (async () => {
      try {
        const [app, auth, fs] = await Promise.all([
          import('firebase/app'),
          import('firebase/auth'),
          import('firebase/firestore'),
        ]);
        const cachedApp = app.getApps().length > 0 ? app.getApp() : app.initializeApp(config);
        return {
          app: cachedApp,
          auth: auth.getAuth(cachedApp),
          db: fs.getFirestore(cachedApp),
          sdk: { app, auth, fs },
        };
      } catch (err) {
        console.error('Falha ao inicializar o Firebase SDK:', err);
        instancesPromise = null;
        return null;
      }
    })();
  }
  return instancesPromise;
}

/* =================================================================================
   SIMULATION / DEMO MODE (Safe offline cryptographic fallback when keys aren't set)
   ================================================================================= */

interface SimulatedUser {
  uid: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode('dms-mtg-salt-v1:' + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getSimulatedUsers(): SimulatedUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SIMULATED_USERS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSimulatedUsers(users: SimulatedUser[]) {
  localStorage.setItem(STORAGE_KEY_SIMULATED_USERS, JSON.stringify(users));
}

function getSimulatedSession(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SIMULATED_SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSimulatedSession(user: UserProfile | null) {
  if (user) {
    localStorage.setItem(STORAGE_KEY_SIMULATED_SESSION, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY_SIMULATED_SESSION);
  }
}

/* =================================================================================
   AUTHENTICATION API (Real Firebase with seamless simulated fallback)
   ================================================================================= */

export async function registerUser(
  username: string,
  email: string,
  password: string
): Promise<UserProfile> {
  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanUsername) throw new Error('Por favor, informe um nome de usuário.');
  if (cleanUsername.length < 3) throw new Error('O nome de usuário deve ter no mínimo 3 caracteres.');
  if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Por favor, informe um e-mail válido.');
  if (!password || password.length < 6) throw new Error('A senha deve conter pelo menos 6 caracteres.');

  const instances = await getFirebaseInstances();

  if (instances) {
    // Real Firebase Auth
    const userCredential = await instances.sdk.auth.createUserWithEmailAndPassword(instances.auth, cleanEmail, password);
    const user = userCredential.user;

    // Set display name to username
    await instances.sdk.auth.updateProfile(user, { displayName: cleanUsername });

    // Note: Email is NOT written to any public Firestore doc. Only username and registration timestamp.
    try {
      await instances.sdk.fs.setDoc(instances.sdk.fs.doc(instances.db, 'users', user.uid), {
        username: cleanUsername,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Não foi possível gravar perfil no Firestore:', e);
    }

    return {
      uid: user.uid,
      username: cleanUsername,
      email: cleanEmail,
    };
  }

  // Fallback: Simulated mode
  const users = getSimulatedUsers();
  if (users.some((u) => u.email === cleanEmail)) {
    throw new Error('Este e-mail já está em uso.');
  }
  if (users.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
    throw new Error('Este nome de usuário já está sendo utilizado.');
  }

  const passwordHash = await hashPassword(password);
  const newUser: SimulatedUser = {
    uid: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    username: cleanUsername,
    email: cleanEmail,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveSimulatedUsers(users);

  const profile: UserProfile = {
    uid: newUser.uid,
    username: newUser.username,
    email: newUser.email,
  };
  setSimulatedSession(profile);
  notifyAuthListeners(profile);

  return profile;
}

export async function loginUser(email: string, password: string): Promise<UserProfile> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) throw new Error('Por favor, informe seu e-mail.');
  if (!password) throw new Error('Por favor, digite sua senha.');

  const instances = await getFirebaseInstances();

  if (instances) {
    const userCredential = await instances.sdk.auth.signInWithEmailAndPassword(instances.auth, cleanEmail, password);
    const user = userCredential.user;
    return {
      uid: user.uid,
      username: user.displayName || 'Jogador',
      email: user.email || cleanEmail,
    };
  }

  // Fallback: Simulated mode
  const users = getSimulatedUsers();
  const passwordHash = await hashPassword(password);
  const found = users.find((u) => u.email === cleanEmail && u.passwordHash === passwordHash);

  if (!found) {
    throw new Error('E-mail ou senha incorretos.');
  }

  const profile: UserProfile = {
    uid: found.uid,
    username: found.username,
    email: found.email,
  };
  setSimulatedSession(profile);
  notifyAuthListeners(profile);

  return profile;
}

export async function logoutUser(): Promise<void> {
  const instances = await getFirebaseInstances();
  if (instances) {
    await instances.sdk.auth.signOut(instances.auth);
    return;
  }

  setSimulatedSession(null);
  notifyAuthListeners(null);
}

/**
 * Sends a password reset link to user's confidential email.
 */
export async function sendForgotPasswordEmail(
  email: string
): Promise<{ success: boolean; message: string; simulated?: boolean; resetLink?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Por favor, informe um endereço de e-mail válido.');
  }

  const instances = await getFirebaseInstances();

  if (instances) {
    await instances.sdk.auth.sendPasswordResetEmail(instances.auth, cleanEmail);
    return {
      success: true,
      message: `Enviamos um link de recuperação para seu e-mail. Verifique sua caixa de entrada (e pasta de spam) para cadastrar sua nova senha com segurança.`,
      simulated: false,
    };
  }

  // Simulated mode
  const users = getSimulatedUsers();
  const user = users.find((u) => u.email === cleanEmail);
  if (!user) {
    // For security reasons, don't reveal if email doesn't exist
    return {
      success: true,
      message: `Se este e-mail estiver cadastrado, um link de recuperação foi enviado para sua caixa de entrada.`,
      simulated: true,
    };
  }

  return {
    success: true,
    message: `[Modo Simulação Local] Um link de recuperação de senha foi gerado para ${cleanEmail}. Em produção com o Firebase conectado, o Google envia este e-mail automaticamente!`,
    simulated: true,
  };
}

/* =================================================================================
   AUTH SUBSCRIPTION LISTENER
   ================================================================================= */

type AuthCallback = (user: UserProfile | null) => void;
const authListeners = new Set<AuthCallback>();

function notifyAuthListeners(user: UserProfile | null) {
  authListeners.forEach((cb) => {
    try {
      cb(user);
    } catch (e) {
      console.error('Erro em ouvinte de auth:', e);
    }
  });
}

export function subscribeToAuth(callback: AuthCallback): () => void {
  authListeners.add(callback);

  if (!isFirebaseConfigured()) {
    // Fallback: Notify with current simulated session
    callback(getSimulatedSession());
    return () => {
      authListeners.delete(callback);
    };
  }

  let cancelled = false;
  let unsubscribe: (() => void) | null = null;

  getFirebaseInstances().then((instances) => {
    if (cancelled) return;
    if (!instances) {
      callback(getSimulatedSession());
      return;
    }
    unsubscribe = instances.sdk.auth.onAuthStateChanged(instances.auth, (firebaseUser: User | null) => {
      if (firebaseUser) {
        callback({
          uid: firebaseUser.uid,
          username: firebaseUser.displayName || 'Jogador',
          email: firebaseUser.email || undefined,
        });
      } else {
        callback(null);
      }
    });
  });

  return () => {
    cancelled = true;
    authListeners.delete(callback);
    unsubscribe?.();
  };
}

/* =================================================================================
   CLOUD SYNC API (Firestore per-user sync & Real-time Cross-Device Sync)
   ================================================================================= */

export function cleanCardForCloud<T extends Card>(card: T): T {
  if (!card) return card;
  const clean: any = {
    id: card.id,
    name: card.name,
    cmc: card.cmc ?? 0,
    typeLine: card.typeLine || '',
    colors: card.colors || [],
    colorIdentity: card.colorIdentity || [],
    rarity: card.rarity || 'common',
    setName: card.setName || '',
    setCode: card.setCode || '',
    collectorNumber: card.collectorNumber || '',
    imageUrl: card.imageUrl || '',
  };

  if (card.oracleId) clean.oracleId = card.oracleId;
  if (card.namePt) clean.namePt = card.namePt;
  if (card.manaCost) clean.manaCost = card.manaCost;
  if (card.oracleText) clean.oracleText = card.oracleText;
  if (card.power !== undefined) clean.power = card.power;
  if (card.toughness !== undefined) clean.toughness = card.toughness;
  if (card.imageUrlLarge) clean.imageUrlLarge = card.imageUrlLarge;
  if (card.imageUrlSmall) clean.imageUrlSmall = card.imageUrlSmall;
  if (card.imageUrlArtCrop) clean.imageUrlArtCrop = card.imageUrlArtCrop;
  if (card.priceUsd !== undefined) clean.priceUsd = card.priceUsd;
  if (card.isFoil) clean.isFoil = card.isFoil;
  if (card.layout) clean.layout = card.layout;
  if (card.artist) clean.artist = card.artist;
  if (card.frame) clean.frame = card.frame;
  if (card.printsSearchUri) clean.printsSearchUri = card.printsSearchUri;
  if (card.faceLabel) clean.faceLabel = card.faceLabel;
  if (card.meldResultName) clean.meldResultName = card.meldResultName;

  if (card.cardFaces && card.cardFaces.length > 0) {
    clean.cardFaces = card.cardFaces.map((f) => ({
      name: f.name,
      manaCost: f.manaCost,
      typeLine: f.typeLine,
      oracleText: f.oracleText,
      colors: f.colors,
      power: f.power,
      toughness: f.toughness,
      imageUrl: f.imageUrl || '',
      imageUrlLarge: f.imageUrlLarge,
      imageUrlSmall: f.imageUrlSmall,
      imageUrlArtCrop: f.imageUrlArtCrop,
      artist: f.artist,
      frame: f.frame,
    }));
  }

  return clean as T;
}

async function optimizeCardImages<T extends Card>(
  card: T,
  compactMode = false
): Promise<T> {
  if (!card) return card;
  const cleaned = cleanCardForCloud(card);

  const maxW = compactMode ? 500 : 800;
  const maxH = compactMode ? 700 : 1120;
  const quality = compactMode ? 0.65 : 0.82;
  const minCompressLen = compactMode ? 40000 : 150000;

  const isDataUrlTooLarge = (url?: string) =>
    Boolean(url && url.startsWith('data:image/') && url.length > minCompressLen);

  const compressIfNeeded = async (url?: string) =>
    isDataUrlTooLarge(url) ? compressDataUrlIfNeeded(url, maxW, maxH, quality, minCompressLen) : url;

  const optimizedUrl = await compressIfNeeded(cleaned.imageUrl);
  const optimizedLarge =
    cleaned.imageUrlLarge === cleaned.imageUrl
      ? optimizedUrl
      : compactMode && cleaned.imageUrlLarge && cleaned.imageUrl
      ? undefined
      : await compressIfNeeded(cleaned.imageUrlLarge);
  const optimizedCrop =
    cleaned.imageUrlArtCrop === cleaned.imageUrl
      ? optimizedUrl
      : await compressIfNeeded(cleaned.imageUrlArtCrop);

  let optimizedFaces = cleaned.cardFaces;
  if (cleaned.cardFaces && cleaned.cardFaces.length > 0) {
    optimizedFaces = await Promise.all(
      cleaned.cardFaces.map(async (face) => {
        const fImg = await compressIfNeeded(face.imageUrl);
        const fLarge =
          face.imageUrlLarge === face.imageUrl
            ? fImg
            : compactMode
            ? undefined
            : await compressIfNeeded(face.imageUrlLarge);
        const fCrop =
          face.imageUrlArtCrop === face.imageUrl
            ? fImg
            : await compressIfNeeded(face.imageUrlArtCrop);
        return {
          ...face,
          imageUrl: fImg || face.imageUrl,
          imageUrlLarge: fLarge,
          imageUrlArtCrop: fCrop,
        };
      })
    );
  }

  const result: any = {
    ...cleaned,
    imageUrl: optimizedUrl || cleaned.imageUrl,
    imageUrlLarge: optimizedLarge,
    imageUrlArtCrop: optimizedCrop,
  };
  if (optimizedFaces) {
    result.cardFaces = optimizedFaces;
  }
  if (compactMode) {
    delete result.imageUrlSmall;
  }

  return result as T;
}

async function optimizeCollectionImages(
  items: CollectionItem[],
  compactMode = false
): Promise<CollectionItem[]> {
  if (!items || items.length === 0) return items;
  return Promise.all(
    items.map(async (item) => {
      const { inUseQuantity, availableQuantity, usedInDecks, ...rest } = item;
      return {
        ...rest,
        card: await optimizeCardImages(item.card, compactMode),
      };
    })
  );
}

async function optimizeDecksImages(
  decks: Deck[],
  compactMode = false
): Promise<Deck[]> {
  if (!decks || decks.length === 0) return decks;
  const maxW = compactMode ? 500 : 800;
  const maxH = compactMode ? 700 : 1120;
  const quality = compactMode ? 0.65 : 0.82;

  return Promise.all(
    decks.map(async (deck) => {
      const optimizedCards = await Promise.all(
        deck.cards.map(async (dc) => ({
          ...dc,
          card: await optimizeCardImages(dc.card, compactMode),
        }))
      );
      const optimizedCover = await compressDataUrlIfNeeded(
        deck.coverImageUrl,
        maxW,
        maxH,
        quality
      );
      const optimizedCommander = deck.commanderCard
        ? await optimizeCardImages(deck.commanderCard, compactMode)
        : deck.commanderCard;
      const optimizedPartner = deck.partnerCard
        ? await optimizeCardImages(deck.partnerCard, compactMode)
        : deck.partnerCard;

      const optimizedTokens = deck.tokens
        ? await Promise.all(
            deck.tokens.map(async (dt) => ({
              ...dt,
              token: (await optimizeCardImages(dt.token as unknown as Card, compactMode)) as unknown as typeof dt.token,
            }))
          )
        : deck.tokens;

      return {
        ...deck,
        tokens: optimizedTokens,
        cards: optimizedCards,
        coverImageUrl: optimizedCover,
        commanderCard: optimizedCommander,
        partnerCard: optimizedPartner,
      };
    })
  );
}

async function optimizeProxiesImages(
  proxies: ProxyItem[],
  compactMode = false
): Promise<ProxyItem[]> {
  if (!proxies || proxies.length === 0) return proxies;
  return Promise.all(
    proxies.map(async (proxy) => ({
      ...proxy,
      card: await optimizeCardImages(proxy.card as Card, compactMode),
    }))
  );
}

/* ---- Documento na nuvem: imagens deduplicadas + gzip em bytes + divisão em partes ---- */

const CHUNKS_SUBCOLLECTION = 'chunks';

export const CLOUD_TOO_LARGE_MESSAGE =
  'Os dados excedem o limite de armazenamento na nuvem mesmo comprimidos. Remova imagens personalizadas muito pesadas ou cartas excedentes.';
export const CLOUD_CHUNK_RULES_MESSAGE =
  'Seus dados passaram de 1MB comprimidos e precisam ser divididos em partes, mas as regras do Firestore ainda não permitem isso. Publique o arquivo firestore.rules atualizado (regra userData/{userId}/chunks) no Firebase Console.';

type CloudContent = Omit<CloudUserData, 'updatedAt' | 'syncRevision' | 'clientSessionId'>;

interface CloudSaveInput {
  collection: CollectionItem[];
  decks: Deck[];
  proxies: ProxyItem[];
  deckTags?: DeckTag[];
  settings?: Record<string, any>;
  clientSessionId?: string;
  syncRevision?: number;
}

interface PreparedCloudPayload {
  payload: CloudUserData;
  /** Conteúdo comprimido (null quando o navegador não suporta CompressionStream). */
  bytes: Uint8Array | null;
  hash: string | null;
}

/** Estado por usuário para evitar gravações repetidas e limpar partes antigas. */
const cloudDocState = new Map<
  string,
  { hash?: string | null; chunks?: number; syncRevision?: number; updatedAt?: string }
>();

function rememberCloudDoc(uid: string, meta: { hash?: string | null; chunks?: number; syncRevision?: number | null; updatedAt?: string }) {
  const prev = cloudDocState.get(uid) || {};
  cloudDocState.set(uid, {
    hash: meta.hash !== undefined ? meta.hash : prev.hash,
    chunks: typeof meta.chunks === 'number' ? meta.chunks : prev.chunks,
    syncRevision: typeof meta.syncRevision === 'number' ? meta.syncRevision : prev.syncRevision,
    updatedAt: meta.updatedAt || prev.updatedAt,
  });
}

async function sanitizeForCloud(data: CloudSaveInput, compact: boolean): Promise<CloudUserData> {
  const collection = await optimizeCollectionImages(data.collection, compact);
  const decks = await optimizeDecksImages(data.decks, compact);
  const proxies = await optimizeProxiesImages(data.proxies, compact);
  const payload: CloudUserData = {
    app: 'proliferate',
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    syncRevision: data.syncRevision,
    clientSessionId: data.clientSessionId,
    collection,
    decks,
    proxies,
    deckTags: data.deckTags || [],
    settings: data.settings || {},
  };
  // Remove undefined (o Firestore rejeita) e referências compartilhadas
  return JSON.parse(JSON.stringify(payload)) as CloudUserData;
}

async function prepareCloudPayload(data: CloudSaveInput, compact = false): Promise<PreparedCloudPayload> {
  const payload = await sanitizeForCloud(data, compact);
  if (!canCompress()) {
    return { payload, bytes: null, hash: null };
  }
  // Só o conteúdo vai comprimido; metadados (revisão, sessão, data) ficam no documento
  const { updatedAt: _u, syncRevision: _r, clientSessionId: _c, ...content } = payload;
  const bytes = await encodeCloudData<CloudContent>(content);
  return { payload, bytes, hash: hashBytes(bytes) };
}

function rawJsonBytes(payload: CloudUserData): number {
  return new TextEncoder().encode(JSON.stringify(payload)).length;
}

export async function buildCloudPayload(data: CloudSaveInput): Promise<CloudUserData> {
  let prepared = await prepareCloudPayload(data, false);
  const sizeOf = (p: PreparedCloudPayload) => (p.bytes ? p.bytes.length : rawJsonBytes(p.payload));
  const limit = prepared.bytes ? MAX_TOTAL_BYTES : 1_040_000;
  if (sizeOf(prepared) > limit) {
    prepared = await prepareCloudPayload(data, true);
  }
  if (sizeOf(prepared) > limit) {
    throw new Error(CLOUD_TOO_LARGE_MESSAGE);
  }
  return prepared.payload;
}

function getCloudErrorCode(err: any): string {
  return String(err?.code || '').replace(/^firestore\//, '');
}

async function writeCloudDoc(
  instances: FirebaseInstances,
  uid: string,
  prepared: PreparedCloudPayload
): Promise<void> {
  const { fs } = instances.sdk;
  const mainRef = fs.doc(instances.db, 'userData', uid);
  const { payload, bytes, hash } = prepared;

  const meta = {
    app: payload.app,
    schemaVersion: payload.schemaVersion,
    updatedAt: payload.updatedAt,
    syncRevision: payload.syncRevision ?? null,
    clientSessionId: payload.clientSessionId ?? null,
  };

  if (!bytes) {
    // Navegador sem CompressionStream: formato antigo (JSON puro, até 1MB)
    if (rawJsonBytes(payload) > 1_040_000) throw new Error(CLOUD_TOO_LARGE_MESSAGE);
    await fs.setDoc(mainRef, payload);
    rememberCloudDoc(uid, { hash: null, chunks: 0, syncRevision: payload.syncRevision, updatedAt: payload.updatedAt });
    return;
  }

  const prevChunks = cloudDocState.get(uid)?.chunks || 0;
  const batch = fs.writeBatch(instances.db);
  let chunkCount = 0;

  if (bytes.length <= SINGLE_DOC_MAX_BYTES) {
    batch.set(mainRef, {
      ...meta,
      format: CLOUD_FORMAT,
      chunks: 0,
      hash,
      size: bytes.length,
      data: fs.Bytes.fromUint8Array(bytes),
    });
  } else {
    const parts = splitBytes(bytes, CHUNK_BYTES);
    chunkCount = parts.length;
    const setId = `${hash}-${Date.now().toString(36)}`;
    parts.forEach((part, i) => {
      batch.set(fs.doc(instances.db, 'userData', uid, CHUNKS_SUBCOLLECTION, String(i)), {
        setId,
        index: i,
        data: fs.Bytes.fromUint8Array(part),
      });
    });
    batch.set(mainRef, {
      ...meta,
      format: CLOUD_FORMAT,
      chunks: chunkCount,
      setId,
      hash,
      size: bytes.length,
    });
  }

  // Remove partes que sobraram de uma gravação anterior maior
  for (let i = chunkCount; i < prevChunks; i++) {
    batch.delete(fs.doc(instances.db, 'userData', uid, CHUNKS_SUBCOLLECTION, String(i)));
  }

  await batch.commit();
  rememberCloudDoc(uid, { hash, chunks: chunkCount, syncRevision: payload.syncRevision, updatedAt: payload.updatedAt });
}

async function decodeCloudDoc(
  instances: FirebaseInstances | null,
  uid: string,
  raw: any
): Promise<CloudUserData> {
  if (raw && raw.format === CLOUD_FORMAT) {
    let bytes: Uint8Array;
    if (raw.chunks > 0) {
      if (!instances) throw new Error('Firebase indisponível para ler as partes do documento.');
      const { fs } = instances.sdk;
      const snaps = await Promise.all(
        Array.from({ length: raw.chunks }, (_, i) =>
          fs.getDoc(fs.doc(instances.db, 'userData', uid, CHUNKS_SUBCOLLECTION, String(i)))
        )
      );
      const parts = snaps.map((s, i) => {
        const d = s.exists() ? (s.data() as any) : null;
        if (!d || d.setId !== raw.setId) {
          throw new Error(`Parte ${i + 1}/${raw.chunks} dos dados na nuvem está desatualizada; tentando de novo.`);
        }
        return d.data.toUint8Array() as Uint8Array;
      });
      bytes = joinBytes(parts);
    } else {
      bytes = raw.data.toUint8Array();
    }
    const content = await decodeCloudData<CloudContent>(bytes);
    rememberCloudDoc(uid, {
      hash: raw.hash ?? null,
      chunks: raw.chunks || 0,
      syncRevision: raw.syncRevision,
      updatedAt: raw.updatedAt,
    });
    return {
      ...content,
      app: raw.app || content.app || 'proliferate',
      schemaVersion: raw.schemaVersion ?? content.schemaVersion ?? 1,
      updatedAt: raw.updatedAt,
      syncRevision: raw.syncRevision ?? undefined,
      clientSessionId: raw.clientSessionId ?? undefined,
    };
  }

  // Formato intermediário (gzip em base64 num campo de texto)
  if (raw && typeof raw.blobGzip === 'string') {
    const full = JSON.parse(await gunzipBytes(base64ToBytes(raw.blobGzip))) as CloudUserData;
    rememberCloudDoc(uid, { hash: null, chunks: 0 });
    return {
      ...full,
      syncRevision: raw.syncRevision ?? full.syncRevision,
      clientSessionId: raw.clientSessionId ?? full.clientSessionId,
    };
  }

  // Formato original (JSON puro)
  rememberCloudDoc(uid, { hash: null, chunks: 0 });
  return raw as CloudUserData;
}

/**
 * Salva os dados do usuário na nuvem.
 * - Não grava nada se o conteúdo for idêntico ao último salvo (economiza cota de escrita).
 * - Usa um documento único até ~1MB comprimido; acima disso divide em partes numa escrita atômica.
 */
export async function saveUserCloudData(uid: string, data: CloudSaveInput): Promise<CloudUserData> {
  const instances = await getFirebaseInstances();

  if (instances) {
    let prepared = await prepareCloudPayload(data, false);
    const known = cloudDocState.get(uid);

    if (prepared.hash && known?.hash && prepared.hash === known.hash) {
      // Nada mudou desde a última gravação/leitura: mantém a revisão que está na nuvem
      return {
        ...prepared.payload,
        syncRevision: known.syncRevision ?? prepared.payload.syncRevision,
        updatedAt: known.updatedAt || prepared.payload.updatedAt,
      };
    }

    if (prepared.bytes && prepared.bytes.length > MAX_TOTAL_BYTES) {
      prepared = await prepareCloudPayload(data, true);
      if (prepared.bytes && prepared.bytes.length > MAX_TOTAL_BYTES) {
        throw new Error(CLOUD_TOO_LARGE_MESSAGE);
      }
    }

    try {
      await writeCloudDoc(instances, uid, prepared);
    } catch (err: any) {
      const isChunked = Boolean(prepared.bytes && prepared.bytes.length > SINGLE_DOC_MAX_BYTES);
      if (!isChunked || getCloudErrorCode(err) !== 'permission-denied') throw err;
      // Regras antigas não permitem partes: tenta caber num único documento com imagens compactadas
      const compact = await prepareCloudPayload(data, true);
      if (compact.bytes && compact.bytes.length <= SINGLE_DOC_MAX_BYTES) {
        await writeCloudDoc(instances, uid, compact);
        return compact.payload;
      }
      throw new Error(CLOUD_CHUNK_RULES_MESSAGE);
    }
    return prepared.payload;
  }

  // Fallback: Simulated cloud storage in localStorage
  const sanitizedPayload = await buildCloudPayload(data);
  try {
    const rawAll = localStorage.getItem(STORAGE_KEY_SIMULATED_CLOUD_DATA);
    const all = rawAll ? JSON.parse(rawAll) : {};
    all[uid] = sanitizedPayload;
    localStorage.setItem(STORAGE_KEY_SIMULATED_CLOUD_DATA, JSON.stringify(all));
    window.dispatchEvent(
      new CustomEvent('proliferate:simulated-cloud-sync', {
        detail: { uid, data: sanitizedPayload },
      })
    );
    return sanitizedPayload;
  } catch (err) {
    console.error('Erro ao salvar dados na simulação de nuvem:', err);
    throw err;
  }
}

export async function loadUserCloudData(uid: string): Promise<CloudUserData | null> {
  const instances = await getFirebaseInstances();

  if (instances) {
    const { fs } = instances.sdk;
    const userDocRef = fs.doc(instances.db, 'userData', uid);
    const snap = await fs.getDoc(userDocRef);
    if (!snap.exists()) {
      rememberCloudDoc(uid, { hash: null, chunks: 0 });
      return null;
    }
    try {
      return await decodeCloudDoc(instances, uid, snap.data());
    } catch {
      // Partes em transição (outro aparelho gravando): uma nova leitura resolve
      const retry = await fs.getDoc(userDocRef);
      return retry.exists() ? decodeCloudDoc(instances, uid, retry.data()) : null;
    }
  }

  // Fallback: Simulated cloud storage
  try {
    const rawAll = localStorage.getItem(STORAGE_KEY_SIMULATED_CLOUD_DATA);
    if (!rawAll) return null;
    const all = JSON.parse(rawAll);
    return all[uid] || null;
  } catch {
    return null;
  }
}

export interface CloudSubscribeOptions {
  /** Sessão deste navegador: ecos das próprias gravações não são baixados/descomprimidos. */
  ownSessionId?: string;
  /** Chamado em vez de onUpdate quando o snapshot é eco desta sessão (só metadados). */
  onOwnEcho?: (meta: { syncRevision?: number; updatedAt: string }) => void;
}

/**
 * Subscribes to real-time updates for a user's cloud data.
 * Fires instantly whenever another device/tab saves changes,
 * achieving real-time synchronization between computers.
 */
export function subscribeToUserCloudData(
  uid: string,
  onUpdate: (data: CloudUserData) => void,
  onError?: (err: any) => void,
  options: CloudSubscribeOptions = {}
): () => void {
  if (isFirebaseConfigured()) {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    getFirebaseInstances().then((instances) => {
      if (cancelled || !instances) return;
      const userDocRef = instances.sdk.fs.doc(instances.db, 'userData', uid);
      unsubscribe = instances.sdk.fs.onSnapshot(
        userDocRef,
        (snap) => {
          // Gravação local ainda não confirmada pelo servidor: nada novo para aplicar
          if (!snap.exists() || snap.metadata.hasPendingWrites) return;
          const raw = snap.data() as any;
          if (options.ownSessionId && raw.clientSessionId === options.ownSessionId) {
            rememberCloudDoc(uid, { syncRevision: raw.syncRevision, updatedAt: raw.updatedAt });
            options.onOwnEcho?.({ syncRevision: raw.syncRevision ?? undefined, updatedAt: raw.updatedAt });
            return;
          }
          decodeCloudDoc(instances, uid, raw)
            .then((d) => {
              if (!cancelled) onUpdate(d);
            })
            .catch((e) => {
              // Partes ainda em transição: o próximo snapshot (ou foco na janela) traz a versão completa
              console.warn('Falha ao decodificar dados da nuvem:', e);
              onError?.(e);
            });
        },
        (err) => {
          console.warn('Erro na escuta em tempo real da nuvem:', err);
          onError?.(err);
        }
      );
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }

  // Fallback: Listen to storage events and custom events for simulated sync
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY_SIMULATED_CLOUD_DATA && e.newValue) {
      try {
        const all = JSON.parse(e.newValue);
        if (all[uid]) {
          onUpdate(all[uid]);
        }
      } catch (err) {
        console.error('Erro ao ler simulação de nuvem via storage event:', err);
      }
    }
  };

  const handleCustomSync = (e: Event) => {
    const custom = e as CustomEvent;
    if (custom.detail?.uid === uid && custom.detail?.data) {
      onUpdate(custom.detail.data);
    }
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener('proliferate:simulated-cloud-sync', handleCustomSync);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('proliferate:simulated-cloud-sync', handleCustomSync);
  };
}

/* =================================================================================
   FRIENDLY ERROR TRANSLATOR
   ================================================================================= */

export function getFriendlyErrorMessage(err: any): string {
  if (!err) return 'Ocorreu um erro inesperado.';
  const message = typeof err === 'string' ? err : err.message || '';
  const code = err.code || '';

  if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'E-mail ou senha incorretos.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'Este endereço de e-mail já está em uso por outra conta.';
  }
  if (code === 'auth/weak-password') {
    return 'A senha deve conter no mínimo 6 caracteres.';
  }
  if (code === 'auth/invalid-email') {
    return 'Por favor, insira um endereço de e-mail válido.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Muitas tentativas malsucedidas. Por segurança, tente novamente em alguns instantes.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Falha de conexão com a internet. Verifique sua rede.';
  }
  if (code === 'auth/configuration-not-found') {
    return 'O provedor de E-mail/Senha ainda não foi ativado no Firebase Console. Vá em Authentication > Sign-in method e ative "E-mail/senha".';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Domínio não autorizado. Adicione seu domínio em Firebase Console > Authentication > Settings > Authorized domains.';
  }
  if (code === 'permission-denied' || code === 'firestore/permission-denied') {
    return 'Acesso não autorizado aos dados na nuvem.';
  }
  if (code === 'resource-exhausted' || code === 'firestore/resource-exhausted') {
    return 'Limite de uso do Firebase atingido por enquanto. As alterações ficam salvas neste aparelho e serão enviadas automaticamente mais tarde.';
  }
  if (code === 'unavailable' || code === 'firestore/unavailable') {
    return 'Servidor da nuvem indisponível no momento. Nova tentativa automática em instantes.';
  }
  if (message.includes('exceeds the maximum allowed size') || message.includes('maximum allowed size')) {
    return CLOUD_TOO_LARGE_MESSAGE;
  }
  if (message.includes('Unsupported field value: undefined')) {
    return 'Erro de formatação de dados para a nuvem. Tentando sincronizar com sanitização automática...';
  }

  return message || 'Ocorreu um erro ao processar sua solicitação.';
}

