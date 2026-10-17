// Plays the score in the browser: the built-in piano reads the notes as written, and an opened audio file (the song as
// the synthesizer rendered it) can play along on the same clock. Notes are scheduled a little ahead on the Web Audio
// clock, so playback stays steady while the page is busy.
import {firstNoteFrom, playbackNotes, tempoMap} from './playback.js';
import {PIANO_SAMPLE_RATE, renderPianoTone} from './piano.js';

const LOOKAHEAD = 0.25, PUMP_MS = 40, LEAD = 0.06, RELEASE = 0.05, NOTE_GAIN = 0.55;

let toneWorker = null, toneBroken = false, nextToneId = 0;
const toneRequests = new Map();

function localTones(pitches) {
  return Promise.resolve().then(() => pitches.map(pitch => renderPianoTone(pitch, PIANO_SAMPLE_RATE)));
}

// Tones render in a worker; without one, or if it fails, on the page.
function renderTones(pitches) {
  if (!pitches.length) return Promise.resolve([]);
  if (!toneWorker && !toneBroken && typeof Worker === 'function') {
    try {
      toneWorker = new Worker(new URL('./piano.worker.js', import.meta.url), {type: 'module'});
      toneWorker.onmessage = ({data}) => {
        const request = toneRequests.get(data.id);
        toneRequests.delete(data.id);
        if (!request) return;
        if (data.error) localTones(request.pitches).then(request.resolve, request.reject);
        else request.resolve(data.tones);
      };
      toneWorker.onerror = event => {
        event.preventDefault?.();
        toneWorker?.terminate();
        toneWorker = null;
        toneBroken = true;
        for (const request of toneRequests.values()) localTones(request.pitches).then(request.resolve, request.reject);
        toneRequests.clear();
      };
    } catch {
      toneWorker = null;
      toneBroken = true;
    }
  }
  if (!toneWorker) return localTones(pitches);
  return new Promise((resolve, reject) => {
    const id = ++nextToneId;
    toneRequests.set(id, {pitches, resolve, reject});
    toneWorker.postMessage({id, pitches});
  });
}

export function createScorePlayer({onEnd} = {}) {
  let context = null, pianoBus = null, audioBus = null;
  let map = tempoMap(null), notes = [];
  const tones = new Map();
  let audio = null, audioOffset = 0, pianoOn = true, audioOn = true;
  let playing = false, origin = 0, startedAt = 0, resting = 0, nextNote = 0, timer = 0, run = 0;
  const sounding = new Set();

  function audioContext() {
    if (context) return context;
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) throw new Error('Web Audio is unavailable in this browser.');
    context = new Context({latencyHint: 'interactive'});
    // A gentle limiter keeps chords of many parts from clipping.
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 6;
    limiter.connect(context.destination);
    pianoBus = context.createGain();
    pianoBus.gain.value = pianoOn ? 1 : 0;
    pianoBus.connect(limiter);
    audioBus = context.createGain();
    audioBus.gain.value = audioOn ? 1 : 0;
    audioBus.connect(context.destination);
    return context;
  }

  const duration = () => Math.max(map.duration, audio ? audioOffset + audio.duration : 0);
  // The context time being heard now. currentTime moves in steps of the audio thread's buffer (often 10 ms or more),
  // which made the playhead stutter; the output timestamp plus the page clock moves every frame and allows for the
  // output latency, so the playhead matches what is heard.
  function heard() {
    const stamp = context.getOutputTimestamp?.();
    if (stamp?.contextTime > 0 && stamp.performanceTime > 0) return stamp.contextTime + (performance.now() - stamp.performanceTime) / 1000;
    return context.currentTime;
  }
  let lastShown = 0;
  function position() {
    if (!playing) return resting;
    // Never step back when a new timestamp lands slightly behind the last estimate.
    lastShown = Math.min(duration(), Math.max(lastShown, origin + heard() - startedAt));
    return Math.max(origin, lastShown);
  }

  async function prepareTones() {
    const missing = [...new Set(notes.map(note => note.pitch))].filter(pitch => !tones.has(pitch));
    const rendered = await renderTones(missing);
    rendered.forEach((samples, index) => {
      const buffer = context.createBuffer(1, samples.length, PIANO_SAMPLE_RATE);
      buffer.copyToChannel(samples, 0);
      tones.set(missing[index], buffer);
    });
  }

  function scheduleNote(note) {
    const buffer = tones.get(note.pitch);
    if (!buffer) return;
    let at = startedAt + note.start - origin, offset = 0;
    // A note already sounding where playback starts begins partway through.
    if (at < startedAt) { offset = startedAt - at; at = startedAt; }
    const releaseAt = startedAt + note.end - origin;
    if (offset >= buffer.duration - 0.01 || releaseAt <= at) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = NOTE_GAIN;
    // The damper: the key's release fades the string out.
    gain.gain.setTargetAtTime(0, releaseAt, RELEASE / 3);
    source.connect(gain).connect(pianoBus);
    source.onended = () => { sounding.delete(source); gain.disconnect(); };
    source.start(at, offset);
    source.stop(Math.min(at + buffer.duration - offset, releaseAt + RELEASE * 4));
    sounding.add(source);
  }

  function startAudio() {
    if (!audio) return;
    const into = origin - audioOffset;
    if (into >= audio.duration) return;
    const source = context.createBufferSource();
    source.buffer = audio;
    source.connect(audioBus);
    source.onended = () => sounding.delete(source);
    if (into >= 0) source.start(startedAt, into);
    else source.start(startedAt - into, 0);
    sounding.add(source);
  }

  function pump() {
    if (!playing) return;
    // Scheduling runs on the audio thread's own clock, ahead of what is heard.
    const horizon = origin + context.currentTime - startedAt + LOOKAHEAD;
    while (nextNote < notes.length && notes[nextNote].start < horizon) scheduleNote(notes[nextNote++]);
    if (position() >= duration()) finish();
  }

  function silence() {
    clearInterval(timer);
    timer = 0;
    for (const source of sounding) { try { source.stop(); } catch { /* not started yet */ } }
    sounding.clear();
  }

  function finish() {
    silence();
    playing = false;
    resting = 0;
    onEnd?.();
  }

  // Creating and resuming the context inside the click keeps browsers that need a gesture for sound happy.
  function unlock() {
    const ctx = audioContext();
    return ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
  }

  async function play(from = resting) {
    const ctx = audioContext();
    const token = ++run;
    silence();
    playing = false;
    await Promise.all([unlock(), prepareTones()]);
    if (token !== run) return false;
    origin = Math.min(Math.max(0, from), duration());
    if (origin >= duration() - 0.01) origin = 0;
    startedAt = ctx.currentTime + LEAD;
    nextNote = firstNoteFrom(notes, origin);
    lastShown = origin;
    playing = true;
    startAudio();
    pump();
    timer = setInterval(pump, PUMP_MS);
    return true;
  }

  function pause() {
    run += 1;
    if (!playing) return;
    resting = position();
    playing = false;
    silence();
  }

  function seek(time) {
    const target = Math.min(Math.max(0, Number(time) || 0), duration());
    if (playing) return play(target);
    resting = target;
    return Promise.resolve(true);
  }

  return {
    get playing() { return playing; },
    position,
    duration,
    toTick: seconds => map.toTick(seconds),
    toSeconds: tick => map.toSeconds(tick),
    unlock,
    /** Renders the piano tones the score needs; playing then starts at once. */
    prepare: () => { audioContext(); return prepareTones(); },
    play,
    pause,
    seek,
    /** A new or re-engraved score; playback carries on from the same time. */
    setScore(model) {
      map = tempoMap(model);
      notes = playbackNotes(model, map);
      if (playing) play(position());
      else resting = Math.min(resting, duration());
    },
    setPiano(on) {
      pianoOn = Boolean(on);
      if (pianoBus) pianoBus.gain.setTargetAtTime(pianoOn ? 1 : 0, context.currentTime, 0.01);
    },
    setAudioEnabled(on) {
      audioOn = Boolean(on);
      if (audioBus) audioBus.gain.setTargetAtTime(audioOn ? 1 : 0, context.currentTime, 0.01);
    },
    /** Decodes an audio file on this device; nothing leaves the browser. */
    async decode(blob) {
      const bytes = await blob.arrayBuffer();
      return audioContext().decodeAudioData(bytes);
    },
    /** The audio to play along, starting `offset` seconds into the score (negative: before it). */
    setAudio(buffer, offset = 0) {
      audio = buffer ?? null;
      audioOffset = Number(offset) || 0;
      if (playing) play(position());
    },
    setAudioOffset(offset) {
      audioOffset = Number(offset) || 0;
      if (playing) play(position());
    },
    dispose() {
      pause();
      context?.close?.();
      context = null;
    },
  };
}
