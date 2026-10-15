// Format handling adapted from UtaFormatix3 (https://github.com/sdercolin/utaformatix3), Apache License 2.0, Copyright 2020 sdercolin.
import { unzipSync } from 'fflate';
import { createProject, decodeText, ticksToBlicks, EXTENSION_LYRIC } from './model.js';

const TICKS_PER_QUARTER = 480;
const BPM_SCALE = 10000;
const LEGATO = new Set(['-', 'ー', '−']);

const list = value => Array.isArray(value) ? value : [];
const baseName = fileName => String(fileName || '').replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
const blicks = ticks => ticksToBlicks(ticks, TICKS_PER_QUARTER);
const hasMagic = (bytes, magic) => [...magic].every((char, index) => bytes[index] === char.charCodeAt(0));
// Keeps the last entry for each key, so a sequence event at the start overrides the constant value.
const lastByKey = (items, key) => [...new Map(items.map(item => [item[key], item])).values()];

function readProject(bytes) {
  if (hasMagic(bytes, 'PPSF')) throw new Error('Unsupported Piapro Studio project: legacy (pre-NT) .ppsf files cannot be imported. Open and save the project in Piapro Studio NT first.');
  let files;
  try { files = unzipSync(bytes, { filter: file => /(^|\/)ppsf\.json$/i.test(file.name) }); }
  catch { throw new Error('Invalid Piapro Studio project: the file is not a Piapro Studio NT archive.'); }
  const entry = Object.values(files)[0];
  if (!entry) throw new Error('Invalid Piapro Studio project: ppsf.json is missing.');
  let source;
  try { source = JSON.parse(decodeText(entry)); }
  catch (error) { throw new Error(`Invalid Piapro Studio project: ${error.message}`); }
  if (!source?.ppsf?.project || typeof source.ppsf.project !== 'object') throw new Error('Invalid Piapro Studio project: missing ppsf.project.');
  return source.ppsf;
}

function lyricOf(value) {
  const lyric = String(value ?? '').trim();
  return LEGATO.has(lyric) ? EXTENSION_LYRIC : lyric;
}

export default {
  id: 'ppsf',
  name: 'Piapro Studio NT',
  extensions: ['ppsf'],
  beta: true,
  detect(bytes) {
    return hasMagic(bytes, 'PPSF') || hasMagic(bytes, 'PK') && new TextDecoder('latin1').decode(bytes.subarray(-65536)).includes('ppsf.json');
  },
  parse(bytes, fileName = '') {
    const root = readProject(bytes);
    const { project } = root;
    const tempo = project.tempo ?? {};
    const tempos = [{ position: 0, bpm: Number(tempo.const ?? 1200000) / BPM_SCALE }];
    if (tempo.use_sequence) tempos.push(...list(tempo.sequence).map(item => ({ position: blicks(item?.tick), bpm: Number(item?.value) / BPM_SCALE })));
    const meter = project.meter ?? {};
    const meters = [{ index: 0, numerator: meter.const?.nume ?? 4, denominator: meter.const?.denomi ?? 4 }];
    if (meter.use_sequence) meters.push(...list(meter.sequence).map(item => ({ index: item?.measure, numerator: item?.nume, denominator: item?.denomi })));
    const tracks = list(project.dvl_track).map((track, index) => ({
      name: track?.name || `Track ${index + 1}`,
      notes: list(track?.events).filter(event => event && (event.enable ?? event.enabled) !== false)
        .map(event => ({ onset: blicks(event.pos), duration: blicks(event.length), pitch: Number(event.note_number), lyrics: lyricOf(event.lyric) }))
    }));
    return createProject({
      format: 'Piapro Studio NT',
      title: String(project.name ?? '').trim() || baseName(fileName),
      version: root.ppsf_ver ?? null,
      tracks,
      tempos: lastByKey(tempos, 'position'),
      meters: lastByKey(meters, 'index')
    });
  }
};
