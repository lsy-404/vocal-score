// Format handling adapted from UtaFormatix3 (https://github.com/sdercolin/utaformatix3), Apache License 2.0, Copyright 2020 sdercolin.
import { classifyInstrument } from './instruments.js';
import { META, metaText, parseMidiFile, readTiming } from './midi-file.js';
import { EXTENSION_LYRIC, createProject, metersFromTicks, ticksToBlicks } from './model.js';
import { hasVsqText } from './vsq-text.js';

const PERCUSSION_CHANNEL = 9;
// Singing tools export "-" (extend the vowel) and "+" (next syllable of the same word) as their own lyrics.
const lyricOf = lyric => lyric === '-' || lyric === '+' ? EXTENSION_LYRIC : lyric;

function readTrack(events) {
  const notes = [], open = new Map(), programs = new Map(), lyrics = new Map(), texts = new Map();
  let name = '', end = 0;
  for (const event of events) {
    end = Math.max(end, event.tick);
    if (event.kind === 'noteOn') {
      const note = { channel: event.channel, pitch: event.key, start: event.tick, end: null };
      const key = event.channel * 128 + event.key;
      notes.push(note);
      if (!open.has(key)) open.set(key, []);
      open.get(key).push(note);
    } else if (event.kind === 'noteOff') {
      const note = open.get(event.channel * 128 + event.key)?.shift();
      if (note) note.end = event.tick;
    } else if (event.kind === 'program') {
      if (!programs.has(event.channel)) programs.set(event.channel, event.program);
    } else if (event.kind === 'meta') {
      if (event.type === META.trackName && !name) name = metaText(event);
      const target = event.type === META.lyric ? lyrics : event.type === META.text ? texts : null;
      if (target) target.set(event.tick, [...(target.get(event.tick) ?? []), metaText(event)]);
    }
  }
  // Lyric events belong to the note starting at the same tick. Tracks without them may carry lyrics as text events,
  // but only trust those when they are about as frequent as notes (a lone text is usually a comment or credit).
  const source = lyrics.size ? lyrics : texts.size * 2 >= notes.length ? texts : new Map();
  for (const note of notes) {
    note.end ??= end;
    note.lyrics = source.get(note.start)?.shift() ?? '';
  }
  const sounding = notes.filter(note => note.end > note.start);
  return { name, notes: sounding, programs, channels: [...new Set(sounding.map(note => note.channel))].sort((a, b) => a - b) };
}

const detect = bytes => {
  try { return !hasVsqText(parseMidiFile(bytes)); }
  catch { return false; }
};

export default {
  id: 'midi',
  name: 'MIDI',
  extensions: ['mid', 'midi'],
  beta: true,
  detect,
  parse(bytes, fileName) {
    const midi = parseMidiFile(bytes);
    const ppq = midi.ticksPerQuarter;
    const parsed = midi.tracks.map(readTrack);
    const programs = new Map();
    parsed.forEach(track => track.programs.forEach((program, channel) => programs.has(channel) || programs.set(channel, program)));
    const tracks = parsed.flatMap((track, index) => track.channels.map(channel => {
      // A format 0 track name is the song title, so its channels are named by number.
      const label = `Channel ${channel + 1}`, base = midi.format === 0 ? '' : track.name || `Track ${index + 1}`;
      const name = !base ? label : track.channels.length > 1 ? `${base} (${label})` : base;
      return {
        id: `midi-track-${index + 1}-${channel + 1}`,
        name,
        instrument: classifyInstrument({ name, program: track.programs.get(channel) ?? programs.get(channel), percussion: channel === PERCUSSION_CHANNEL }),
        notes: track.notes.filter(note => note.channel === channel).map(note => ({
          onset: ticksToBlicks(note.start, ppq),
          duration: ticksToBlicks(note.end, ppq) - ticksToBlicks(note.start, ppq),
          pitch: note.pitch,
          lyrics: lyricOf(note.lyrics)
        }))
      };
    }));
    // The first track of a format 1 file names the sequence; it is the title when it holds no notes.
    const title = (midi.format === 0 || !parsed[0].notes.length ? parsed[0].name : '') || String(fileName ?? '').replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
    const timing = readTiming(midi);
    return createProject({
      format: 'MIDI',
      title,
      tracks,
      tempos: timing.tempos.map(tempo => ({ position: ticksToBlicks(tempo.tick, ppq), bpm: tempo.bpm })),
      meters: metersFromTicks(timing.signatures, ppq),
      warnings: midi.warnings
    });
  }
};
