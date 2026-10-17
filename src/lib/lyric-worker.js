// One lyric alignment worker for the page. Requests are coalesced: while one alignment runs, only the newest waiting
// request is kept and older waiting ones resolve to null. Without workers, alignment runs on the page instead.

let worker = null, broken = false, warming = null, running = null, waiting = null, nextId = 0, suggesting = null;

const local = () => import('./lyric-alignment.js');
const localCandidates = request => import('./lyric-candidates.js').then(({findLyricCandidates}) => findLyricCandidates(request.tracks, request.meters));

// Only what alignment reads: track identity and each note's lyric.
function plainTracks(tracks) {
  return (tracks ?? []).map(track => ({id: track.id, name: track.name, notes: (track.notes ?? []).map(note => ({lyrics: String(note.lyrics ?? '')}))}));
}

// A worker that failed to load or crashed is not started again; waiting requests finish on the page.
function failed(message) {
  worker?.terminate();
  worker = null;
  broken = true;
  const pending = [running, waiting].filter(Boolean);
  running = waiting = null;
  if (suggesting) { const request = suggesting; suggesting = null; localCandidates(request).then(request.resolve, request.reject); }
  for (const request of pending) local().then(({alignLyricsToTracks}) => request.resolve(alignLyricsToTracks(request.text, request.tracks, {write: request.write}))).catch(request.reject);
  return new Error(message);
}

function start() {
  if (worker || broken || typeof Worker !== 'function') return worker;
  try {
    worker = new Worker(new URL('./lyric-alignment.worker.js', import.meta.url), {type: 'module'});
  } catch {
    worker = null;
    return null;
  }
  worker.onmessage = ({data}) => {
    if (data.type === 'ready') { warming?.resolve(true); return; }
    if (data.type === 'candidates') {
      if (suggesting?.id !== data.id) return;
      const request = suggesting;
      suggesting = null;
      data.error ? request.reject(new Error(data.error)) : request.resolve(data.result);
      return;
    }
    const request = running;
    running = null;
    if (request && data.id === request.id) data.type === 'error' ? request.reject(new Error(data.error)) : request.resolve(data.result);
    send();
  };
  worker.onerror = event => { event.preventDefault?.(); warming?.reject(failed(event.message || 'The lyric worker failed.')); };
  return worker;
}

function send() {
  if (running || !waiting) return;
  running = waiting;
  waiting = null;
  worker.postMessage({id: running.id, text: running.text, tracks: running.tracks, write: running.write});
}

/** Starts the worker and loads the pinyin dictionary; resolves true when ready, false when alignment runs on the page. */
export function warmLyricAlignment() {
  if (!start()) return local().then(() => false);
  if (!warming) {
    let resolve, reject;
    const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
    warming = {promise, resolve, reject};
    worker.postMessage({type: 'warm'});
  }
  return warming.promise;
}

/** Aligns text to the tracks off the page. Resolves to the alignment, or null when a newer request replaced this one. */
export function alignLyrics(text, tracks, {write = 'typed'} = {}) {
  const request = {id: ++nextId, text: String(text ?? ''), tracks: plainTracks(tracks), write};
  if (!start()) return local().then(({alignLyricsToTracks}) => alignLyricsToTracks(request.text, request.tracks, {write}));
  return new Promise((resolve, reject) => {
    waiting?.resolve(null);
    waiting = {...request, resolve, reject};
    send();
  });
}

/**
 * Characters the song offers for lyrics typed as pinyin (see lyric-candidates.js). Resolves to the list, or null when a
 * newer request replaced this one.
 */
export function suggestLyrics(tracks, meters) {
  const request = {
    id: ++nextId,
    tracks: (tracks ?? []).map(track => ({id: track.id, name: track.name, notes: (track.notes ?? []).map(note => ({onset: note.onset, duration: note.duration, lyrics: String(note.lyrics ?? '')}))})),
    meters: (meters ?? []).map(meter => ({index: meter.index, numerator: meter.numerator, denominator: meter.denominator})),
  };
  if (!start()) return localCandidates(request);
  return new Promise((resolve, reject) => {
    suggesting?.resolve(null);
    suggesting = {...request, resolve, reject};
    worker.postMessage({type: 'candidates', id: request.id, tracks: request.tracks, meters: request.meters});
  });
}

/** Writes aligned corrections into the tracks; returns how many notes changed. Kept here so the page needs no pinyin data. */
export function applyAlignedLyrics(tracks, changes) {
  let count = 0;
  for (const change of changes) {
    const note = tracks[change.trackIndex]?.notes?.[change.noteIndex];
    if (!note) continue;
    note.lyrics = change.to;
    count += 1;
  }
  return count;
}
