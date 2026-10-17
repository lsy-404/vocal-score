import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUARTER, createScore, parseSvp } from '../src/lib/converter.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const args = process.argv.slice(2);
let outDir;
const files = [];
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--out') {
    outDir = args[++i];
    if (!outDir) throw new Error('--out requires a directory');
  } else {
    files.push(args[i]);
  }
}
if (outDir) {
  const relative = path.relative(repoRoot, path.resolve(outDir));
  if (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)) {
    throw new Error('--out must point outside the repository');
  }
}
if (files.length !== 2) {
  throw new Error('Usage: node test/verify-files.js <first.svp> <second.svp> [--out <directory>]');
}

function parseRootJson(text) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}' && --depth === 0) {
      end = i + 1;
      break;
    }
  }
  if (end < 0) throw new Error('Could not find a complete JSON root object');
  return JSON.parse(text.slice(0, end));
}

function semanticRows(root) {
  return (root.library ?? []).flatMap((group, groupIndex) =>
    (group.notes ?? []).map((note, noteIndex) => ({
      groupIndex,
      noteIndex,
      onset: note.onset,
      duration: note.duration,
      pitch: note.pitch,
      lyric: note.lyrics,
      phonemes: note.phonemes,
      detune: note.detune,
    })),
  );
}

function midiFromPitchXml(noteXml) {
  const step = noteXml.match(/<step>([A-G])<\/step>/)?.[1];
  const octave = Number(noteXml.match(/<octave>(-?\d+)<\/octave>/)?.[1]);
  const alter = Number(noteXml.match(/<alter>(-?\d+(?:\.\d+)?)<\/alter>/)?.[1] ?? 0);
  const semitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  if (!step || !Number.isFinite(octave)) throw new Error('MusicXML note has an invalid pitch');
  return (octave + 1) * 12 + semitones[step] + alter;
}

function xmlNoteEvents(xml, divisions, meter) {
  const parts = xml.match(/<part\b[^>]*>[\s\S]*?<\/part>/g) ?? [];
  const measureLength = meter.numerator * 4 / meter.denominator * divisions;
  return parts.map((part, partIndex) => {
    const measures = part.match(/<measure\b[^>]*>[\s\S]*?<\/measure>/g) ?? [];
    const events = [];
    measures.forEach((measure, measureIndex) => {
      let cursor = 0;
      const tokens = measure.match(/<(forward|backup|note)\b[^>]*>[\s\S]*?<\/\1>/g) ?? [];
      for (const token of tokens) {
        const duration = Number(token.match(/<duration>(\d+)<\/duration>/)?.[1] ?? 0);
        if (token.startsWith('<forward')) cursor += duration;
        else if (token.startsWith('<backup')) cursor -= duration;
        else {
          if (/<pitch(?:\s|>)/.test(token)) {
            events.push({
              onset: measureIndex * measureLength + cursor,
              duration,
              pitch: midiFromPitchXml(token),
              tieStart: /<tie type="start"\s*\/>/.test(token),
              tieStop: /<tie type="stop"\s*\/>/.test(token),
            });
          }
          cursor += duration;
        }
      }
    });
    const merged = [];
    for (const event of events) {
      const previous = merged.at(-1);
      if (previous && previous.pitch === event.pitch && previous.onset + previous.duration === event.onset && previous.tieStart && event.tieStop) {
        previous.duration += event.duration;
        previous.tieStart = event.tieStart;
      } else {
        merged.push({ ...event });
      }
    }
    return { partIndex, notes: merged.map(({ onset, duration, pitch }) => ({ onset, duration, pitch })) };
  });
}

function validateXml(xml, tracks, expectedNotes, grid, meter, file) {
  assert.equal(typeof xml, 'string', `${file}: XML output is missing`);
  assert.match(xml, /<score-partwise(?:\s|>)/, `${file}: missing score-partwise root`);
  assert.match(xml, /<\/score-partwise\s*>/, `${file}: incomplete score-partwise document`);
  const parts = xmlNoteEvents(xml, grid, meter);
  assert.equal(parts.length, tracks.length, `${file}: MusicXML part count differs from selected tracks`);
  let exported = 0;
  parts.forEach((part, index) => {
    const expected = tracks[index].notes.map(note => ({
      onset: Math.round(note.onset / QUARTER * grid),
      duration: Math.round((note.onset + note.duration) / QUARTER * grid) - Math.round(note.onset / QUARTER * grid),
      pitch: note.pitch,
    })).sort((a, b) => a.onset - b.onset || a.pitch - b.pitch);
    assert.deepEqual(part.notes, expected, `${file}: MusicXML timing or pitch changed in part ${index + 1}`);
    exported += part.notes.length;
  });
  assert.equal(exported, expectedNotes, `${file}: MusicXML sounding note count differs from source`);
}

const reports = [];
const semanticSets = [];
for (const file of files) {
  const text = await readFile(file, 'utf8');
  const root = parseRootJson(text);
  const sourceRows = semanticRows(root);
  const parsed = parseSvp(text, path.basename(file));
  const project = parsed?.project ?? parsed;
  const tracks = project.tracks;
  if (!Array.isArray(tracks)) throw new Error('parseSvp result does not expose project.tracks');
  const trackIds = tracks.map(track => track.id);
  if (!trackIds.length) throw new Error(`${file}: no vocal tracks were exposed`);
  const sourceNotes = sourceRows.length;
  const parsedNotes = tracks.reduce((sum, track) => sum + track.notes.length, 0);
  assert.equal(parsedNotes, sourceNotes, `${file}: parseSvp did not preserve source note count`);
  const result = createScore(project, { trackIds, grid: 16, transpose: 0, fifths: 0 });
  assert.ok(result?.stats, `${file}: score statistics are missing`);
  assert.ok(Array.isArray(result.parts), `${file}: score parts are missing`);
  assert.equal(result.stats.noteCount, sourceNotes, `${file}: exported source note count changed`);
  assert.equal(result.stats.partCount, tracks.length, `${file}: exported part count changed`);
  validateXml(result.xml, tracks, sourceNotes, 16, root.time.meter[0], file);
  if (outDir) {
    await mkdir(outDir, { recursive: true });
    const target = path.join(outDir, `${path.basename(file, path.extname(file))}.musicxml`);
    await writeFile(target, result.xml, 'utf8');
  }
  semanticSets.push(sourceRows);
  reports.push({
    file: path.basename(file),
    sourceNoteCount: sourceNotes,
    parsedTrackCount: tracks.length,
    scoreStats: result.stats,
    warningCount: (parsed?.warnings ?? result.warnings ?? []).length,
  });
}
assert.deepEqual(semanticSets[0], semanticSets[1], 'The two files differ in expanded musical note content');
console.log(JSON.stringify({ semanticEquality: true, reports }, null, 2));
