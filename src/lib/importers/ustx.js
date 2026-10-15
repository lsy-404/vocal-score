// Format handling adapted from UtaFormatix3 (https://github.com/sdercolin/utaformatix3), Apache License 2.0, Copyright 2020 sdercolin.
import { parse as parseYaml } from 'yaml';
import { createProject, decodeText, ticksToBlicks, EXTENSION_LYRIC } from './model.js';

const RESTS = new Set(['', 'R', 'r', 'SP', 'AP']);
const DEFAULT_PROJECT_NAME = 'New Project';

const list = value => Array.isArray(value) ? value : [];
const baseName = fileName => String(fileName || '').replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');

// Phonemizers accept "lyric [phonemes]" or "[phonemes]"; "+", "+~", "+*" and "+n" extend the previous syllable.
function lyricOf(value) {
  let lyric = String(value ?? '').trim();
  const phonemes = /\[([^[\]]*)\]$/.exec(lyric);
  if (phonemes) lyric = lyric.slice(0, phonemes.index).trim() || phonemes[1].trim();
  return lyric === '-' || lyric.startsWith('+') ? EXTENSION_LYRIC : lyric;
}

export default {
  id: 'ustx',
  name: 'OpenUtau',
  extensions: ['ustx'],
  beta: true,
  detect(bytes) {
    return /^\s*ustx_version\s*:/m.test(new TextDecoder().decode(bytes.subarray(0, 4096)));
  },
  parse(bytes, fileName = '') {
    let source;
    try { source = parseYaml(decodeText(bytes)); }
    catch (error) { throw new Error(`Invalid OpenUtau project: ${error.message}`); }
    if (!source || typeof source !== 'object' || !(Array.isArray(source.tracks) || Array.isArray(source.voice_parts))) {
      throw new Error('Invalid OpenUtau project: expected tracks and voice_parts lists.');
    }
    const resolution = Number(source.resolution) > 0 ? Number(source.resolution) : 480;
    const blicks = ticks => ticksToBlicks(ticks, resolution);
    const tempos = list(source.tempos).length
      ? source.tempos.map(item => ({ position: blicks(item?.position ?? 0), bpm: item?.bpm }))
      : [{ position: 0, bpm: source.bpm ?? 120 }];
    const meters = list(source.time_signatures).length
      ? source.time_signatures.map(item => ({ index: item?.bar_position ?? 0, numerator: item?.beat_per_bar, denominator: item?.beat_unit }))
      : [{ index: 0, numerator: source.beat_per_bar ?? 4, denominator: source.beat_unit ?? 4 }];
    const tracks = list(source.tracks).map((track, index) => ({ name: track?.track_name || `Track ${index + 1}`, notes: [] }));
    for (const part of list(source.voice_parts)) {
      const index = Number(part?.track_no ?? 0);
      if (!part || !Number.isInteger(index) || index < 0) continue;
      while (tracks.length <= index) tracks.push({ name: `Track ${tracks.length + 1}`, notes: [] });
      const offset = Number(part.position ?? 0);
      for (const note of list(part.notes)) {
        const lyrics = lyricOf(note?.lyric);
        if (RESTS.has(lyrics)) continue;
        tracks[index].notes.push({ onset: blicks(offset + Number(note.position)), duration: blicks(note.duration), pitch: Number(note.tone), lyrics });
      }
    }
    const name = String(source.name ?? '').trim();
    return createProject({
      format: 'OpenUtau',
      title: name && name !== DEFAULT_PROJECT_NAME ? name : baseName(fileName),
      version: source.ustx_version == null ? null : String(source.ustx_version),
      tracks,
      tempos,
      meters
    });
  }
};
