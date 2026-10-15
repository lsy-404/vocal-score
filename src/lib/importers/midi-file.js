// Format handling adapted from UtaFormatix3 (https://github.com/sdercolin/utaformatix3), Apache License 2.0, Copyright 2020 sdercolin.
// Standard MIDI File reader shared by the MIDI, VOCALOID MIDI and VSQ importers.
import { decodeText } from './model.js';

export const META = { text: 0x01, trackName: 0x03, lyric: 0x05, endOfTrack: 0x2f, tempo: 0x51, timeSignature: 0x58 };

const TRUNCATED = Symbol('truncated');
const ascii = (bytes, start, length) => String.fromCharCode(...bytes.subarray(start, start + length));

function readTrack(bytes, start, end, fail) {
  const events = [];
  let at = start, tick = 0, running = 0;
  const byte = () => { if (at >= end) throw TRUNCATED; return bytes[at++]; };
  const varLength = () => { let value = 0, next; do { next = byte(); value = value * 128 + (next & 0x7f); } while (next & 0x80); return value; };
  const take = length => { if (at + length > end) throw TRUNCATED; return bytes.subarray(at, at += length); };
  try {
    while (at < end) {
      tick += varLength();
      let status = byte();
      if (status === 0xff) {
        const type = byte();
        events.push({ tick, kind: 'meta', type, data: take(varLength()) });
        if (type === META.endOfTrack) break;
      } else if (status === 0xf0 || status === 0xf7) {
        events.push({ tick, kind: 'sysex', data: take(varLength()) });
      } else {
        if (status < 0x80) {
          if (!running) fail('data byte without a running status');
          at -= 1;
          status = running;
        } else if (status > 0xef) fail(`unexpected status byte 0x${status.toString(16)}`);
        running = status;
        const type = status >> 4, channel = status & 0x0f;
        const first = byte(), second = type === 0xc || type === 0xd ? 0 : byte();
        if (type === 0x9 && second > 0) events.push({ tick, kind: 'noteOn', channel, key: first, velocity: second });
        else if (type === 0x8 || type === 0x9) events.push({ tick, kind: 'noteOff', channel, key: first });
        else if (type === 0xc) events.push({ tick, kind: 'program', channel, program: first });
      }
    }
  } catch (error) {
    if (error !== TRUNCATED) throw error;
    return { events, truncated: true };
  }
  return { events, truncated: false };
}

/**
 * Parses an SMF (format 0, 1 or 2, optionally wrapped in RIFF RMID) into tracks of events with absolute ticks:
 * noteOn/noteOff { channel, key }, program { channel, program }, meta { type, data } and sysex { data }.
 * A note-on with velocity 0 is reported as noteOff; running status is honoured.
 */
export function parseMidiFile(input, label = 'MIDI file') {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const fail = message => { throw new Error(`Invalid ${label}: ${message}.`); };
  const u16 = at => (bytes[at] << 8) + bytes[at + 1];
  const u32 = at => bytes[at] * 0x1000000 + (bytes[at + 1] << 16) + (bytes[at + 2] << 8) + bytes[at + 3];
  let at = ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'RMID' ? 20 : 0;
  if (bytes.length < at + 14 || ascii(bytes, at, 4) !== 'MThd') fail('missing MThd header');
  const headerLength = u32(at + 4), format = u16(at + 8), division = u16(at + 12);
  if (headerLength < 6 || format > 2) fail('unsupported header');
  if (division & 0x8000) fail('SMPTE time division is not supported');
  if (!division) fail('zero ticks per quarter note');
  const tracks = [], warnings = [];
  for (at += 8 + headerLength; at + 8 <= bytes.length && /^[\x20-\x7e]{4}$/.test(ascii(bytes, at, 4)); at += 8 + u32(at + 4)) {
    if (ascii(bytes, at, 4) !== 'MTrk') continue;
    const { events, truncated } = readTrack(bytes, at + 8, Math.min(at + 8 + u32(at + 4), bytes.length), fail);
    if (truncated) warnings.push(`MIDI track ${tracks.length + 1} is truncated.`);
    tracks.push(events);
  }
  if (!tracks.length) fail('no MTrk chunks');
  return { format, ticksPerQuarter: division, tracks, warnings };
}

/** Text of a meta event (UTF-8 or Shift_JIS) without control characters. */
export const metaText = event => decodeText(event.data).replace(/[\0-\x1f]/g, '').trim();

/** Tempo (bpm) and time-signature changes from every track in absolute ticks; the last event at a tick wins. */
export function readTiming(midi) {
  const tempos = new Map(), signatures = new Map();
  const metas = midi.tracks.flat().filter(event => event.kind === 'meta').sort((a, b) => a.tick - b.tick);
  for (const { tick, type, data } of metas) {
    const micros = (data[0] << 16) | (data[1] << 8) | data[2];
    if (type === META.tempo && data.length >= 3 && micros > 0) tempos.set(tick, { tick, bpm: Math.round(6e10 / micros) / 1000 });
    else if (type === META.timeSignature && data.length >= 2 && data[0] > 0 && data[1] < 8) signatures.set(tick, { tick, numerator: data[0], denominator: 2 ** data[1] });
  }
  return { tempos: [...tempos.values()], signatures: [...signatures.values()] };
}
