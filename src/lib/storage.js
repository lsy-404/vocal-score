const DATABASE_NAME = 'svp-vocal-score';
const STORE_NAME = 'documents';
const DATABASE_VERSION = 1;

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

function transact(mode, action) {
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
      transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      action(store, value => { readResult = value; });
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

/**
 * Brings settings saved by older versions up to date. Projects saved before notation styles stored the old default
 * merge level 'low' as their own setting; they move to automatic merging like new projects.
 */
export function upgradeSettings(settings = {}) {
  return settings.glides === undefined && settings.noteMerge === 'low' ? { ...settings, noteMerge: 'auto' } : settings;
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
