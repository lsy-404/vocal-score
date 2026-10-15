// Pattern clip and bar-position rules follow LibreSVIP's description of ACE Studio projects (https://github.com/SoulMelody/LibreSVIP, MIT).
import { decompress } from 'fzstd';
import { EXTENSION_LYRIC, createProject, decodeText, ticksToBlicks } from './model.js';

const TICKS_PER_QUARTER = 480;
const list = value => Array.isArray(value) ? value : [];
const fail = message => { throw new Error(`Invalid ACE Studio project: ${message}.`); };

function parseJson(text, what) {
  try { return JSON.parse(text); }
  catch { return fail(`${what} is not valid JSON`); }
}

// An .acep file is a JSON envelope whose `content` is the project JSON, zstd-compressed and base64-encoded.
function readProject(bytes) {
  if (String.fromCharCode(...bytes.subarray(0, 5)) === 'ACEP2') throw new Error('Unsupported ACE Studio project: binary ACEP2 files cannot be imported yet.');
  const envelope = parseJson(decodeText(bytes), 'the file');
  if (!envelope || typeof envelope !== 'object') fail('expected a JSON object');
  if (Array.isArray(envelope.tracks)) return envelope;
  const { compressMethod, content } = envelope;
  if (content && typeof content === 'object') return content;
  if (typeof content !== 'string') fail('missing content');
  if (!compressMethod && /^\s*\{/.test(content)) return parseJson(content, 'the content');
  // Envelope versions 1 and 2 (early ACE Studio releases) encrypt the content.
  if (envelope.version === 1 || envelope.version === 2) throw new Error('Unsupported ACE Studio project: encrypted projects from early ACE Studio versions cannot be imported.');
  let data;
  try { data = Uint8Array.from(atob(content), char => char.charCodeAt(0)); }
  catch { fail('content is not valid base64'); }
  if (compressMethod === 'zstd') {
    try { data = decompress(data); }
    catch { fail('content could not be decompressed'); }
  } else if (compressMethod) throw new Error(`Unsupported ACE Studio project: unknown compression "${compressMethod}".`);
  return parseJson(decodeText(data), 'the content');
}

// "-" extends the previous note; multi-syllable Latin words are split over notes as "word#1", "word#2", ...
function lyricOf(note) {
  const lyric = String(note.lyric ?? '').trim();
  const syllable = /^(.*)#(\d+)$/.exec(lyric);
  if (syllable) return syllable[2] === '1' ? syllable[1] : EXTENSION_LYRIC;
  return lyric === '-' ? EXTENSION_LYRIC : lyric;
}

export default {
  id: 'acep',
  name: 'ACE Studio',
  extensions: ['acep'],
  beta: true,
  parse(bytes, fileName) {
    const project = readProject(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    if (!project || !Array.isArray(project.tracks)) fail('expected a tracks array');
    const ticks = value => ticksToBlicks(value, TICKS_PER_QUARTER);
    const warnings = [];
    const tracks = project.tracks.flatMap((track, index) => {
      if (track?.type !== 'sing') return [];
      const name = String(track.name || `Track ${index + 1}`);
      const notes = [];
      for (const pattern of list(track.patterns)) {
        if (pattern?.enabled === false) { warnings.push(`Track ${name}: skipped a disabled pattern.`); continue; }
        // Note positions are relative to the pattern start `pos`; only the window [clipPos, clipPos + clipDur)
        // of the pattern is visible, and notes reaching outside it are cut at its edges.
        const offset = Number(pattern.pos) || 0, clipStart = Number(pattern.clipPos) || 0;
        const clipEnd = clipStart + Number(pattern.clipDur ?? pattern.dur ?? Infinity);
        for (const note of list(pattern.notes)) {
          const pos = Number(note?.pos), start = Math.max(pos, clipStart, -offset) + offset, end = Math.min(pos + Number(note?.dur), clipEnd) + offset;
          if (end > start) notes.push({ onset: ticks(start), duration: ticks(end) - ticks(start), pitch: Number(note.pitch), lyrics: lyricOf(note) });
        }
      }
      return [{ id: `acep-track-${index + 1}`, name, notes }];
    });
    const tempos = list(project.tempos).map(tempo => ({ position: ticks(tempo?.position), bpm: Number(tempo?.bpm) }));
    if (list(project.tempos).some(tempo => tempo?.isLerp)) warnings.push('Gradual tempo changes were imported as sudden changes.');
    // barPos is a measure index, not a tick position.
    const meters = list(project.timeSignatures).map(signature => ({ index: signature?.barPos, numerator: signature?.numerator, denominator: signature?.denominator }));
    const title = project.name ? String(project.name) : String(fileName ?? '').replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
    return createProject({ format: 'ACE Studio', title, version: project.version ?? null, tracks, tempos, meters, warnings });
  }
};
