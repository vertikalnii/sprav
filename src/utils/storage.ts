/**
 * Storage Layer — изолированное хранилище данных внутри приложения.
 * Использует IndexedDB для персистентного хранения всего состояния.
 * Работает как "контейнер" — все данные внутри, ничего не утекает наружу.
 */

import { Employee, TrueConfUser, DiscrepancyReport, ProcessingStats } from '../types';

const DB_NAME = 'spravochnik_container';
const DB_VERSION = 1;
const STORE_STATE = 'app_state';
const STORE_FILES = 'files';
const STORE_HISTORY = 'history';

export interface StoredFile {
  id: string;
  name: string;
  type: 'reference' | 'trueconf';
  data: ArrayBuffer;
  size: number;
  uploadedAt: string;
  recordCount: number;
}

export interface AppState {
  employees: Employee[];
  trueConfUsers: TrueConfUser[];
  discrepancies: DiscrepancyReport[];
  stats: ProcessingStats;
  refFileName: string;
  tcFiles: string[];
  lastUpdated: string;
  version: number;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  snapshot?: {
    employeeCount: number;
    matchedCount: number;
  };
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_STATE)) {
        db.createObjectStore(STORE_STATE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        const historyStore = db.createObjectStore(STORE_HISTORY, { keyPath: 'id' });
        historyStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// === STATE ===

export async function saveState(state: AppState): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_STATE, 'readwrite');
    const store = tx.objectStore(STORE_STATE);
    store.put({ id: 'main', ...state });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function loadState(): Promise<AppState | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_STATE, 'readonly');
    const store = tx.objectStore(STORE_STATE);
    const request = store.get('main');
    request.onsuccess = () => { db.close(); resolve(request.result || null); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

// === FILES ===

export async function saveFile(file: StoredFile): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FILES, 'readwrite');
    const store = tx.objectStore(STORE_FILES);
    store.put(file);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getAllFiles(): Promise<StoredFile[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FILES, 'readonly');
    const store = tx.objectStore(STORE_FILES);
    const request = store.getAll();
    request.onsuccess = () => { db.close(); resolve(request.result || []); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function deleteFile(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FILES, 'readwrite');
    const store = tx.objectStore(STORE_FILES);
    store.delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function clearAllFiles(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FILES, 'readwrite');
    const store = tx.objectStore(STORE_FILES);
    store.clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// === HISTORY ===

export async function addHistory(entry: Omit<HistoryEntry, 'id'>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_HISTORY, 'readwrite');
    const store = tx.objectStore(STORE_HISTORY);
    store.put({
      ...entry,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getHistory(limit: number = 50): Promise<HistoryEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_HISTORY, 'readonly');
    const store = tx.objectStore(STORE_HISTORY);
    const index = store.index('timestamp');
    const request = index.openCursor(null, 'prev');
    const results: HistoryEntry[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        db.close();
        resolve(results);
      }
    };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function clearHistory(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_HISTORY, 'readwrite');
    const store = tx.objectStore(STORE_HISTORY);
    store.clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// === FULL RESET ===

export async function clearAll(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_STATE, STORE_FILES, STORE_HISTORY], 'readwrite');
    tx.objectStore(STORE_STATE).clear();
    tx.objectStore(STORE_FILES).clear();
    tx.objectStore(STORE_HISTORY).clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// === STORAGE INFO ===

export async function getStorageInfo(): Promise<{ files: number; totalSize: number; historyCount: number }> {
  const files = await getAllFiles();
  const history = await getHistory(1000);
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  return {
    files: files.length,
    totalSize,
    historyCount: history.length,
  };
}
