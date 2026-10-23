/**
 * Uploaded documents stay on this device: file bytes are kept in IndexedDB,
 * keyed by document id. Nothing is sent to a server.
 */
const DB = "smaran-files";
const STORE = "files";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const saveFile = (id: string, blob: Blob) => tx("readwrite", (s) => s.put(blob, id));
export const loadFile = (id: string) => tx<Blob | undefined>("readonly", (s) => s.get(id) as IDBRequest<Blob | undefined>);
export const deleteFile = (id: string) => tx("readwrite", (s) => s.delete(id));

export async function clearFiles() {
  if (typeof indexedDB === "undefined") return;
  try {
    await tx("readwrite", (s) => s.clear());
  } catch {
    /* nothing stored yet */
  }
}

export const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
