// FL Studio project (.flp) importer: one staff per channel-rack channel, with each pattern's notes placed where
// that pattern's clips sit in the first arrangement's playlist (patterns loop when a clip is longer than them).
import { classifyInstrument } from './instruments.js';
import { createProject, metersFromTicks, ticksToBlicks } from './model.js';

// An FLdt chunk is a stream of events: one id byte, then a payload whose size the id range decides
// (0-63 byte, 64-127 word, 128-191 dword, 192-255 varint length + data).
const EVENT = {
  enabled: 0, numerator: 17, denominator: 18, markerNumerator: 33, markerDenominator: 34,
  channel: 64, pattern: 65, tempoCoarse: 66, tempoFine: 93, mixerSlot: 98, arrangement: 99,
  markerPosition: 148, tempo: 156, channelName: 192, patternName: 193, title: 194, version: 199,
  pluginInternalName: 201, pluginName: 203, notes: 224, mixerParams: 225, playlist: 233, insertFlags: 236,
  trackData: 238, trackName: 239, arrangementName: 241
};
// FL 2026 writes event 172 with a one-byte payload although its id is in the dword range.
const SIZE_OVERRIDES = [{}, { 172: 1 }];
const PATTERN_BASE = 20480; // playlist item index = PATTERN_BASE + pattern number; lower indexes are audio/automation clips
const NOTE_SIZE = 24;
const NOTE_SLIDE = 0x08;
const CLIP_MUTED = 0x2000;
const SIGNATURE_MARKER = 0x08000000; // time-marker positions at or above this are time-signature markers
const MAX_NOTES = 200000;
const UNKNOWN_ORDER = classifyInstrument({}).order;
const utf16 = new TextDecoder('utf-16le');
const utf8 = new TextDecoder('utf-8');

const fail = message => { throw new Error(`Invalid FL Studio project: ${message}`); };

function readHeader(bytes, view) {
  const tag = at => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (bytes.length < 4 || tag(0) !== 'FLhd') fail('missing the FLhd header.');
  const headerSize = bytes.length >= 14 ? view.getUint32(4, true) : 0;
  if (headerSize < 6 || 8 + headerSize > bytes.length) fail('the FLhd header is truncated or invalid.');
  const format = view.getInt16(8, true), channelCount = view.getUint16(10, true), ppq = view.getUint16(12, true);
  if (format !== 0 && format !== -1) fail(`file format ${format} is an FL Studio preset or score, not a project.`);
  if (!ppq) fail('the timebase (PPQ) is zero.');
  for (let at = 8 + headerSize; at + 8 <= bytes.length;) {
    const size = view.getUint32(at + 4, true);
    if (tag(at) === 'FLdt') {
      if (at + 8 + size > bytes.length) fail(`the data chunk is truncated (${size} bytes declared, ${bytes.length - at - 8} present).`);
      return { channelCount, ppq, start: at + 8, end: at + 8 + size };
    }
    at += 8 + size;
  }
  return fail('missing the FLdt data chunk.');
}

function readEvents(bytes, start, end, overrides) {
  const events = [];
  for (let at = start; at < end;) {
    const id = bytes[at++];
    let size = overrides[id] ?? (id < 64 ? 1 : id < 128 ? 2 : id < 192 ? 4 : -1);
    if (size < 0) {
      size = 0;
      for (let shift = 0; ; shift += 7) {
        if (at >= end || shift > 28) fail(`event ${id} has a truncated or invalid length.`);
        const byte = bytes[at++];
        size += (byte & 0x7f) * 2 ** shift;
        if (byte < 0x80) break;
      }
    }
    if (at + size > end) fail(`event ${id} runs past the end of the file.`);
    events.push({ id, at, size });
    at += size;
  }
  return events;
}

// The classic size rules and the FL 2026 one are both tried; the right one consumes the stream exactly and finds
// as many channels as the header declares.
function tokenize(bytes, start, end, channelCount) {
  const attempts = SIZE_OVERRIDES.map(overrides => {
    try { return readEvents(bytes, start, end, overrides); } catch (error) { return error; }
  });
  const parsed = attempts.filter(item => Array.isArray(item));
  if (!parsed.length) throw attempts[0];
  return parsed.find(events => events.filter(event => event.id === EVENT.channel).length === channelCount) ?? parsed[0];
}

// The playlist record grew from 32 bytes (FL 12-20) to 60 (FL 21), 80 (seen in FL 25) and 88 (FL 2026) without a
// version tag, so the stride is the smallest one that puts the constant pattern base at every record head.
function playlistStride(view, at, size) {
  for (let stride = 32; stride <= 256; stride += 4) {
    if (size % stride) continue;
    let fits = true;
    for (let offset = 0; fits && offset < size; offset += stride) fits = view.getUint16(at + offset + 4, true) === PATTERN_BASE && view.getUint16(at + offset + 12, true) <= 500;
    if (fits) return stride;
  }
  return fail(`the playlist data (${size} bytes) does not match any known FL Studio layout.`);
}

// Bytes 24-31 of a pattern clip are its cut window: int32 ticks (-1 when uncut); some older saves store float32 beats.
function clipOffset(view, at, ppq) {
  const ticks = view.getInt32(at, true);
  if (ticks < 0x800000) return Math.max(0, ticks);
  const beats = view.getFloat32(at, true);
  return Number.isFinite(beats) && beats > 0 ? Math.round(beats * ppq) : 0;
}

function readFile(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const { channelCount, ppq, start, end } = readHeader(bytes, view);
  const text = event => utf16.decode(bytes.subarray(event.at, event.at + event.size)).replace(/\0+$/u, '').trim();
  const value = event => event.size === 1 ? bytes[event.at] : event.size === 2 ? view.getUint16(event.at, true) : event.size === 4 ? view.getUint32(event.at, true) : 0;
  const file = { ppq, version: '', title: '', tempo: null, tempoCoarse: null, tempoFine: 0, numerator: 4, denominator: 4, channels: new Map(), patterns: new Map(), arrangements: [] };
  const looseMarkers = [];
  let context = '', channel = null, pattern = null, arrangement = null, track = null, marker = null;
  const newArrangement = name => {
    arrangement = { name, items: [], markers: [], tracks: new Map() };
    file.arrangements.push(arrangement);
    return arrangement;
  };
  for (const event of tokenize(bytes, start, end, channelCount)) {
    const { id } = event;
    // The version text stays ASCII even where every other text event is UTF-16LE (FL 11.5 and later).
    if (id === EVENT.version) file.version = utf8.decode(bytes.subarray(event.at, event.at + event.size)).replace(/\0+$/u, '').trim();
    else if (id === EVENT.title) file.title = text(event);
    else if (id === EVENT.tempo) file.tempo = value(event) / 1000;
    else if (id === EVENT.tempoCoarse) file.tempoCoarse = value(event);
    else if (id === EVENT.tempoFine) file.tempoFine = value(event);
    else if (id === EVENT.numerator) file.numerator = value(event);
    else if (id === EVENT.denominator) file.denominator = value(event);
    else if (id === EVENT.channel) {
      context = 'channel';
      const iid = value(event);
      if (!file.channels.has(iid)) file.channels.set(iid, { iid, name: '', legacyName: '', plugin: '', enabled: true });
      channel = file.channels.get(iid);
    } else if (id === EVENT.pattern) {
      context = 'pattern';
      const iid = value(event);
      if (!file.patterns.has(iid)) file.patterns.set(iid, { iid, name: '', notes: [] });
      pattern = file.patterns.get(iid);
    } else if (id === EVENT.arrangement) {
      context = 'arrangement';
      newArrangement('');
    } else if (id === EVENT.insertFlags || id === EVENT.mixerParams || id === EVENT.mixerSlot) context = 'mixer';
    else if (context === 'channel') {
      // Plugin events also describe mixer effects, so they name a channel only inside its own block.
      if (id === EVENT.pluginName) channel.name = text(event);
      else if (id === EVENT.channelName) channel.legacyName = text(event);
      else if (id === EVENT.pluginInternalName) channel.plugin = text(event);
      else if (id === EVENT.enabled) channel.enabled = value(event) !== 0;
    }
    if (context === 'pattern' && id === EVENT.patternName) pattern.name = text(event);
    else if (context === 'pattern' && id === EVENT.notes) {
      if (event.size % NOTE_SIZE) fail(`pattern ${pattern.iid} note data has ${event.size} bytes, not a multiple of ${NOTE_SIZE}.`);
      for (let at = event.at; at < event.at + event.size; at += NOTE_SIZE) {
        pattern.notes.push({ position: view.getUint32(at, true), flags: view.getUint16(at + 4, true), channel: view.getUint16(at + 6, true), length: view.getUint32(at + 8, true), key: view.getUint16(at + 12, true) });
      }
    } else if (id === EVENT.playlist) {
      // Projects older than FL 12.9 have a single playlist and no arrangement events.
      const target = arrangement ?? newArrangement('');
      const stride = event.size ? playlistStride(view, event.at, event.size) : 0;
      for (let at = event.at; at < event.at + event.size; at += stride) {
        target.items.push({ position: view.getUint32(at, true), index: view.getUint16(at + 6, true), length: view.getUint32(at + 8, true), track: view.getUint16(at + 12, true), flags: view.getUint16(at + 18, true), offset: clipOffset(view, at + 24, ppq) });
      }
    } else if (context === 'arrangement' && id === EVENT.arrangementName) arrangement.name = text(event);
    else if (context === 'arrangement' && id === EVENT.trackData && event.size >= 13) {
      track = { iid: view.getUint32(event.at, true), name: '', enabled: bytes[event.at + 12] !== 0 };
      arrangement.tracks.set(track.iid, track);
    } else if (context === 'arrangement' && id === EVENT.trackName && track) track.name = text(event);
    else if (context !== 'pattern' && (id === EVENT.markerPosition || id === EVENT.markerNumerator || id === EVENT.markerDenominator)) {
      // Pattern markers only annotate the piano roll; playlist markers before the first arrangement event belong to it.
      const key = id === EVENT.markerPosition ? 'position' : id === EVENT.markerNumerator ? 'numerator' : 'denominator';
      const markers = arrangement?.markers ?? looseMarkers;
      if (!marker || key in marker || !markers.includes(marker)) markers.push(marker = {});
      marker[key] = value(event);
    }
  }
  if (file.arrangements[0] && !file.arrangements[0].markers.length) file.arrangements[0].markers = looseMarkers;
  return file;
}

function channelLabel(channel, iid) {
  return channel?.name || channel?.legacyName || channel?.plugin || `Channel ${iid + 1}`;
}

// Generic synth names ("Infiniti Player #3") say nothing about the instrument, so the playlist track that holds
// most of a channel's notes ("Cello") is tried next, then the plugin's own name ("FPC").
function classifyChannel(channel, iid, trackName) {
  const label = channelLabel(channel, iid);
  for (const name of [label, trackName, channel?.plugin]) {
    const instrument = name ? classifyInstrument({ name }) : null;
    if (instrument && instrument.order !== UNKNOWN_ORDER) return instrument;
  }
  return classifyInstrument({ name: label });
}

function parse(bytes, fileName = '') {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const file = readFile(input);
  const warnings = [];
  if (!file.version) fail('the FL Studio version is missing.');
  const [major = 0, minor = 0, patch = 0] = String(file.version).split('.').map(part => Number.parseInt(part, 10) || 0);
  if (major < 12) fail(`FL Studio ${file.version} projects are not supported; re-save the project in FL Studio 12 or newer.`);
  const { ppq } = file;
  let { numerator, denominator } = file;
  if (!(numerator >= 1 && numerator <= 32) || ![1, 2, 4, 8, 16, 32].includes(denominator)) {
    warnings.push(`Unsupported time signature ${numerator}/${denominator}; 4/4 was used.`);
    numerator = 4; denominator = 4;
  }
  const barTicks = ppq * 4 * numerator / denominator;

  // Like FL's Auto pattern length, a pattern ends with the bar holding its last note; longer clips repeat it from there.
  const stepTicks = Math.max(1, Math.round(ppq / 4));
  let slides = 0;
  const patterns = new Map();
  for (const pattern of file.patterns.values()) {
    const notes = pattern.notes.filter(note => !(note.flags & NOTE_SLIDE));
    slides += pattern.notes.length - notes.length;
    if (!notes.length) continue;
    // Step-sequencer notes have length 0; they are written as one step.
    for (const note of notes) note.length ||= stepTicks;
    const extent = notes.reduce((max, note) => Math.max(max, note.position + note.length), 0);
    patterns.set(pattern.iid, { ...pattern, notes, loop: Math.max(1, Math.ceil(extent / barTicks)) * barTicks });
  }
  if (slides) warnings.push(`Skipped ${slides} slide note(s); FL Studio slide notes bend other notes rather than play.`);

  const [arrangement] = file.arrangements;
  if (file.arrangements.length > 1) warnings.push(`The project has ${file.arrangements.length} arrangements; only the first (${arrangement.name || 'Arrangement'}) was imported.`);
  // Clips store their playlist track reversed: track = 500 - index since FL 12.9.1 (500 tracks), 199 - index before.
  const trackSpace = major > 12 || minor > 9 || (minor === 9 && patch >= 1) ? 500 : 199;
  let clips = (arrangement?.items ?? []).filter(item => item.index > PATTERN_BASE).map(item => ({ ...item, pattern: patterns.get(item.index - PATTERN_BASE), track: arrangement.tracks.get(trackSpace - item.track) }));
  if (!clips.length) {
    let position = 0;
    clips = [...patterns.values()].sort((a, b) => a.iid - b.iid).map(pattern => {
      const clip = { position, length: pattern.loop, offset: 0, flags: 0, pattern, track: null };
      position += pattern.loop;
      return clip;
    });
    if (clips.length) warnings.push('The playlist has no pattern clips; patterns were placed one after another.');
  } else {
    const placed = new Set(clips.map(clip => clip.pattern?.iid));
    const unused = [...patterns.values()].filter(pattern => !placed.has(pattern.iid)).map(pattern => pattern.name || `Pattern ${pattern.iid}`);
    if (unused.length) warnings.push(`Skipped pattern(s) not placed in the playlist: ${unused.join(', ')}.`);
    const muted = clips.filter(clip => clip.flags & CLIP_MUTED).length;
    if (muted) warnings.push(`${muted} playlist clip(s) are muted in FL Studio; their notes were imported anyway.`);
    const mutedTracks = [...new Set(clips.filter(clip => clip.pattern && clip.track && !clip.track.enabled).map(clip => clip.track))]
      .sort((a, b) => a.iid - b.iid).map(track => track.name || `Track ${track.iid}`);
    if (mutedTracks.length) warnings.push(`Playlist track(s) ${mutedTracks.join(', ')} are muted in FL Studio; their notes were imported anyway.`);
  }

  // Absolute note time = clip position + (pattern time - clip start offset), for pattern time inside the clip window.
  const byChannel = new Map();
  let total = 0, capped = false;
  for (const clip of clips) {
    const { pattern, position, length, offset } = clip;
    if (!pattern || !length) continue;
    for (let loop = Math.floor(offset / pattern.loop) * pattern.loop; loop < offset + length && !capped; loop += pattern.loop) {
      for (const note of pattern.notes) {
        const time = loop + note.position;
        if (time < offset || time >= offset + length) continue;
        if (++total > MAX_NOTES) { capped = true; break; }
        const onset = position + time - offset;
        if (!byChannel.has(note.channel)) byChannel.set(note.channel, { notes: new Map(), tracks: new Map() });
        const target = byChannel.get(note.channel);
        const key = `${onset}:${note.key}`;
        const duration = Math.min(note.length, position + length - onset);
        // The same note from overlapping copies of a clip is one note on the staff.
        if ((target.notes.get(key)?.duration ?? 0) < duration) target.notes.set(key, { onset, duration, pitch: note.key });
        const trackName = clip.track?.name ?? '';
        target.tracks.set(trackName, (target.tracks.get(trackName) ?? 0) + 1);
      }
    }
  }
  if (capped) warnings.push(`The project expands to more than ${MAX_NOTES} notes; the rest were skipped.`);

  const rack = new Map([...file.channels.keys()].map((iid, index) => [iid, index]));
  if (!byChannel.size) warnings.push('The project has no pattern notes.');
  const tracks = [...byChannel.keys()].sort((a, b) => (rack.get(a) ?? Infinity) - (rack.get(b) ?? Infinity) || a - b).map(iid => {
    const channel = file.channels.get(iid);
    const { notes, tracks: trackCounts } = byChannel.get(iid);
    const [trackName] = [...trackCounts].sort((a, b) => b[1] - a[1])[0];
    if (channel && !channel.enabled) warnings.push(`Channel ${channelLabel(channel, iid)} is muted in FL Studio; its notes were imported anyway.`);
    // A channel named after its plugin ("Infiniti Player #3", "LABS") reads better on the score under its playlist track's name.
    const label = channelLabel(channel, iid);
    const generic = classifyInstrument({ name: label }).order === UNKNOWN_ORDER || /\s#\d+$/u.test(label);
    return {
      id: `flp-channel-${iid}`,
      name: generic && trackName ? trackName : label,
      label,
      notes: [...notes.values()].map(note => ({ onset: ticksToBlicks(note.onset, ppq), duration: ticksToBlicks(note.duration, ppq), pitch: note.pitch, lyrics: '' })),
      instrument: classifyChannel(channel, iid, trackName)
    };
  });
  const names = tracks.map(track => track.name);
  for (const track of tracks) {
    if (names.filter(name => name === track.name).length > 1 && track.name !== track.label) track.name = `${track.name} · ${track.label}`;
    delete track.label;
  }

  const signatures = [{ tick: 0, numerator, denominator }, ...(arrangement?.markers ?? [])
    .filter(marker => marker.position >= SIGNATURE_MARKER && marker.numerator > 0 && [1, 2, 4, 8, 16, 32].includes(marker.denominator))
    .map(marker => ({ tick: marker.position - SIGNATURE_MARKER, numerator: marker.numerator, denominator: marker.denominator }))];
  let bpm = file.tempo ?? (file.tempoCoarse !== null ? file.tempoCoarse + file.tempoFine / 1000 : null);
  if (!(bpm > 0)) {
    warnings.push('The project has no tempo; FL Studio\'s default 140 BPM was used.');
    bpm = 140;
  }
  return createProject({
    format: 'FL Studio',
    title: file.title || String(fileName).replace(/^.*[\\/]/u, '').replace(/\.flp$/iu, ''),
    version: file.version,
    tracks,
    tempos: [{ position: 0, bpm }],
    meters: metersFromTicks(signatures, ppq),
    warnings
  });
}

export default { id: 'flp', name: 'FL Studio', extensions: ['flp'], beta: true, parse };
