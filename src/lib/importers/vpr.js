// Format handling adapted from UtaFormatix3 (https://github.com/sdercolin/utaformatix3), Apache License 2.0, Copyright 2020 sdercolin.
import { unzipSync } from 'fflate';
import { EXTENSION_LYRIC, createProject, decodeText, ticksToBlicks } from './model.js';

const FORMAT = 'VOCALOID 5/6';
const TICKS_PER_QUARTER = 480;
const AUDIO_TRACK = 1;

const baseName = fileName => String(fileName || '').replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
const list = value => Array.isArray(value) ? value : [];

function partNotes(part) {
  const offset = Number(part?.pos) || 0;
  const end = Number(part?.duration) > 0 ? Number(part.duration) : Infinity;
  // Notes past the end of a part are muted by the editor.
  return list(part?.notes).filter(note => Number(note?.pos) < end).map(note => ({
    onset: ticksToBlicks(offset + Number(note.pos), TICKS_PER_QUARTER),
    duration: ticksToBlicks(Math.min(Number(note.duration), end - Number(note.pos)), TICKS_PER_QUARTER),
    pitch: note.number,
    lyrics: note.lyric === '-' ? EXTENSION_LYRIC : String(note.lyric ?? '')
  }));
}

export default {
  id: 'vpr',
  name: FORMAT,
  extensions: ['vpr'],
  beta: true,
  parse(bytes, fileName = '') {
    let files;
    try { files = unzipSync(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)); } catch { throw new Error('Invalid VPR project: the file is not a zip archive.'); }
    const entry = Object.keys(files).find(path => path.replaceAll('\\', '/').toLowerCase() === 'project/sequence.json');
    if (!entry) throw new Error('Invalid VPR project: Project/sequence.json is missing.');
    let source;
    try { source = JSON.parse(decodeText(files[entry])); } catch (error) { throw new Error(`Invalid VPR project: ${error.message}`); }
    if (!source || typeof source !== 'object' || !Array.isArray(source.tracks)) throw new Error('Invalid VPR project: expected a tracks array.');

    const master = source.masterTrack ?? {};
    const global = master.tempo?.global;
    const tempos = global?.isEnabled && global.value > 0 ? [{ position: 0, bpm: global.value / 100 }]
      : list(master.tempo?.events).map(event => ({ position: ticksToBlicks(event?.pos ?? 0, TICKS_PER_QUARTER), bpm: Number(event?.value) / 100 }));
    const meters = list(master.timeSig?.events).map(event => ({ index: event?.bar, numerator: event?.numer, denominator: event?.denom }));
    const tracks = source.tracks.map((track, index) => track && track.type !== AUDIO_TRACK
      ? { id: `vpr-track-${index + 1}`, name: track.name || `Track ${index + 1}`, notes: list(track.parts).flatMap(partNotes) }
      : null).filter(Boolean);
    const { major, minor, revision } = source.version ?? {};
    const version = major === undefined ? null : [major, minor, revision].filter(item => item !== undefined).join('.');

    return createProject({ format: FORMAT, title: source.title || baseName(fileName), version, tracks, tempos, meters });
  }
};
