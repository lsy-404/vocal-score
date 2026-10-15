// Format handling adapted from UtaFormatix3 (https://github.com/sdercolin/utaformatix3), Apache License 2.0, Copyright 2020 sdercolin.
import { createProject, decodeText } from './model.js';

// S5P stores onset, duration and tempo positions in blicks like SVP: 1470000 per 1/480 quarter = 705600000 per quarter.
const list = value => Array.isArray(value) ? value : [];
const baseName = fileName => String(fileName || '').replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');

export default {
  id: 's5p',
  name: 'Synthesizer V',
  extensions: ['s5p'],
  beta: true,
  parse(bytes, fileName = '') {
    const text = decodeText(bytes);
    let source;
    try { source = JSON.parse(text.slice(0, text.lastIndexOf('}') + 1)); }
    catch (error) { throw new Error(`Invalid Synthesizer V (S5P) project: ${error.message}`); }
    if (!source || typeof source !== 'object' || !Array.isArray(source.tracks)) {
      throw new Error('Invalid Synthesizer V (S5P) project: expected a tracks array.');
    }
    const tracks = source.tracks.map((track, index) => ({
      order: Number.isFinite(track?.displayOrder) ? track.displayOrder : index,
      name: track?.name || track?.displayName || `Track ${index + 1}`,
      notes: list(track?.notes).filter(Boolean)
        .map(note => ({ onset: note.onset, duration: note.duration, pitch: note.pitch, lyrics: String(note.lyric ?? '').trim() }))
    })).sort((a, b) => a.order - b.order);
    return createProject({
      format: 'Synthesizer V',
      title: baseName(fileName),
      version: source.version ?? null,
      tracks,
      tempos: list(source.tempo).map(item => ({ position: item?.position, bpm: item?.beatPerMinute })),
      meters: list(source.meter).map(item => ({ index: item?.measure, numerator: item?.beatPerMeasure, denominator: item?.beatGranularity }))
    });
  }
};
