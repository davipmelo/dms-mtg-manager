import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  Auth,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  Firestore,
} from 'firebase/firestore';
import { UserProfile, CloudUserData, CollectionItem, Deck, ProxyItem } from '../types';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

const STORAGE_KEY_CUSTOM_CONFIG = 'dms_mtg_firebase_config_v1';
const STORAGE_KEY_SIMULATED_USERS = 'dms_mtg_simulated_users_v1';
const STORAGE_KEY_SIMULATED_SESSION = 'dms_mtg_simulated_session_v1';
const STORAGE_KEY_SIMULATED_CLOUD_DATA = 'dms_mtg_simulated_cloud_v1';

/**
 * Checks if user has configured custom Firebase keys in localStorage or in .env
 */
export function getStoredFirebaseConfig(): FirebaseConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Erro ao ler Firebase Config do localStorage:', err);
  }
  return null;
}

export function saveStoredFirebaseConfig(config: FirebaseConfig): void {
  localStorage.setItem(STORAGE_KEY_CUSTOM_CONFIG, JSON.stringify(config));
  // Re-initialize Firebase on next call
  cachedApp = null;
  cachedAuth = null;
  cachedDb = null;
}

export function clearStoredFirebaseConfig(): void {
  localStorage.removeItem(STORAGE_KEY_CUSTOM_CONFIG);
  cachedApp = null;
  cachedAuth = null;
  cachedDb = null;
}

export function getActiveFirebaseConfig(): FirebaseConfig | null {
  // 1. Custom config in localStorage
  const custom = getStoredFirebaseConfig();
  if (custom) return custom;

  // 2. Vite environment variables
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

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

function getFirebaseInstances(): { app: FirebaseApp; auth: Auth; db: Firestore } | null {
  const config = getActiveFirebaseConfig();
  if (!config) return null;

  try {
    if (!cachedApp) {
      cachedApp = getApps().length > 0 ? getApp() : initializeApp(config);
      cachedAuth = getAuth(cachedApp);
      cachedDb = getFirestore(cachedApp);
    }
    return { app: cachedApp, auth: cachedAuth!, db: cachedDb! };
  } catch (err) {
    console.error('Falha ao inicializar o Firebase SDK:', err);
    return null;
  }
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

  const instances = getFirebaseInstances();

  if (instances) {
    // Real Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(instances.auth, cleanEmail, password);
    const user = userCredential.user;

    // Set display name to username
    await updateProfile(user, { displayName: cleanUsername });

    // Note: Email is NOT written to any public Firestore doc. Only username and registration timestamp.
    try {
      await setDoc(doc(instances.db, 'users', user.uid), {
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

  const instances = getFirebaseInstances();

  if (instances) {
    const userCredential = await signInWithEmailAndPassword(instances.auth, cleanEmail, password);
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
  const instances = getFirebaseInstances();
  if (instances) {
    await signOut(instances.auth);
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

  const instances = getFirebaseInstances();

  if (instances) {
    await sendPasswordResetEmail(instances.auth, cleanEmail);
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

  const instances = getFirebaseInstances();

  if (instances) {
    const unsubscribe = onAuthStateChanged(instances.auth, (firebaseUser: User | null) => {
      if (firebaseUser) {
        const profile: UserProfile = {
          uid: firebaseUser.uid,
          username: firebaseUser.displayName || 'Jogador',
          email: firebaseUser.email || undefined,
        };
        callback(profile);
      } else {
        callback(null);
      }
    });

    return () => {
      authListeners.delete(callback);
      unsubscribe();
    };
  }

  // Fallback: Notify with current simulated session
  const current = getSimulatedSession();
  callback(current);

  return () => {
    authListeners.delete(callback);
  };
}

/* =================================================================================
   CLOUD SYNC API (Firestore per-user sync)
   ================================================================================= */

export async function saveUserCloudData(
  uid: string,
  data: {
    collection: CollectionItem[];
    decks: Deck[];
    proxies: ProxyItem[];
  }
): Promise<void> {
  const instances = getFirebaseInstances();

  const payload: CloudUserData = {
    app: 'dms-mtg-manager',
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    collection: data.collection,
    decks: data.decks,
    proxies: data.proxies,
  };

  if (instances) {
    const userDocRef = doc(instances.db, 'userData', uid);
    await setDoc(userDocRef, payload);
    return;
  }

  // Fallback: Simulated cloud storage in localStorage
  try {
    const rawAll = localStorage.getItem(STORAGE_KEY_SIMULATED_CLOUD_DATA);
    const all = rawAll ? JSON.parse(rawAll) : {};
    all[uid] = payload;
    localStorage.setItem(STORAGE_KEY_SIMULATED_CLOUD_DATA, JSON.stringify(all));
  } catch (err) {
    console.error('Erro ao salvar dados na simulação de nuvem:', err);
    throw err;
  }
}

export async function loadUserCloudData(uid: string): Promise<CloudUserData | null> {
  const instances = getFirebaseInstances();

  if (instances) {
    const userDocRef = doc(instances.db, 'userData', uid);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) return null;
    return snap.data() as CloudUserData;
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
  if (code === 'permission-denied') {
    return 'Acesso não autorizado aos dados na nuvem.';
  }

  return message || 'Ocorreu um erro ao processar sua solicitação.';
}

