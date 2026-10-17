const DATABASE_NAME = 'svp-vocal-score';
const STORE_NAME = 'documents';
// Songs (audio files a synthesizer exported) to play along with scores. They are kept apart from documents, so
// saving a document never rewrites them, and one song can serve several documents. The store keeps its first name.
const SONG_STORE = 'audio';
const DATABASE_VERSION = 2;

function describe(error) {
  return error?.message || String(error || 'unknown error');
}

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('IndexedDB is unavailable in this browser.'));
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    const fail = message => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    };
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, {keyPath: 'id'});
      if (!database.objectStoreNames.contains(SONG_STORE)) database.createObjectStore(SONG_STORE, {keyPath: 'id'});
    };
    request.onerror = () => fail(`Could not open local document storage: ${describe(request.error)}.`);
    request.onblocked = () => fail('Could not open local document storage because another tab is blocking the database upgrade. Close the other tab and retry.');
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      resolve(request.result);
    };
  });
}

function transact(mode, action, stores = [STORE_NAME]) {
  return openDatabase().then(database => new Promise((resolve, reject) => {
    let settled = false;
    let actionError = null;
    let readResult;
    let transaction;
    const fail = message => {
      if (settled) return;
      settled = true;
      database.close();
      reject(new Error(message));
    };
    try {
      transaction = database.transaction(stores, mode);
      const store = transaction.objectStore(stores[0]);
      action(store, value => { readResult = value; }, transaction);
    } catch (error) {
      database.close();
      reject(new Error(`Could not start local document storage transaction: ${describe(error)}.`));
      return;
    }
    transaction.onerror = event => {
      actionError = event.target?.error || transaction.error || actionError;
    };
    transaction.onabort = () => fail(`Local document storage transaction failed: ${describe(actionError || transaction.error)}.`);
    transaction.oncomplete = () => {
      if (settled) return;
      settled = true;
      database.close();
      resolve(readResult);
    };
  }));
}

function timestamp(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value) || 0;
  return 0;
}

// The pop lead sheet preset as it was before it drew slurs over melismas (settings without a style version).
const LEAD_SHEET_V1 = { noteMerge: 'auto', glides: 'line', melisma: 'extender', tupletMarks: 'bracket', swing: false };

/**
 * Brings settings saved by older versions up to date. Projects saved before notation styles stored the old default
 * merge level 'low' as their own setting; they move to automatic merging like new projects. Projects saved with the pop
 * lead sheet before it drew slurs follow the preset to slur + extender. Settings saved from now on carry styleVersion 2,
 * so a style chosen later is never changed.
 */
export function upgradeSettings(settings = {}) {
  let upgraded = settings.glides === undefined && settings.noteMerge === 'low' ? { ...settings, noteMerge: 'auto' } : settings;
  if (upgraded.styleVersion === undefined && Object.entries(LEAD_SHEET_V1).every(([key, value]) => upgraded[key] === value)) upgraded = { ...upgraded, melisma: 'both' };
  return upgraded;
}

export function loadDocuments() {
  return transact('readonly', (store, setResult) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const records = request.result;
      records.sort((left, right) => timestamp(right.updatedAt) - timestamp(left.updatedAt));
      setResult(records);
    };
  });
}

export function saveDocument(record) {
  if (!record || typeof record !== 'object' || typeof record.id !== 'string' || !record.id) {
    return Promise.reject(new TypeError('A document record must have a nonempty string id.'));
  }
  let copy;
  try {
    copy = structuredClone(record);
  } catch (error) {
    return Promise.reject(new TypeError(`Document record cannot be stored: ${describe(error)}.`));
  }
  return transact('readwrite', store => { store.put(copy); });
}

export function deleteDocument(id) {
  if (typeof id !== 'string' || !id) return Promise.reject(new TypeError('A document id must be a nonempty string.'));
  return transact('readwrite', store => { store.delete(id); });
}

/** Songs kept in this browser, newest first: {id, name, type, size, blob, updatedAt}. */
export function loadSongs() {
  return transact('readonly', (store, setResult) => {
    const request = store.getAll();
    request.onsuccess = () => setResult([...request.result].sort((left, right) => timestamp(right.updatedAt) - timestamp(left.updatedAt)));
  }, [SONG_STORE]);
}

export function saveSong({id, name, blob}) {
  if (typeof id !== 'string' || !id || !(blob instanceof Blob)) return Promise.reject(new TypeError('A song needs an id and a Blob.'));
  return transact('readwrite', store => { store.put({id, name: String(name || ''), type: blob.type, size: blob.size, blob, updatedAt: Date.now()}); }, [SONG_STORE]);
}

export function deleteSong(id) {
  return transact('readwrite', store => { store.delete(id); }, [SONG_STORE]);
}
