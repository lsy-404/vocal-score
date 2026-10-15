// Format handling adapted from UtaFormatix3 (https://github.com/sdercolin/utaformatix3), Apache License 2.0, Copyright 2020 sdercolin.
import { EXTENSION_LYRIC, createProject, decodeText, ticksToBlicks } from './model.js';

const FORMAT = 'UtaFormatix';
const TICKS_PER_QUARTER = 480;
const SUPPORTED_VERSION = 1;

const baseName = fileName => String(fileName || '').replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
const list = value => Array.isArray(value) ? value : [];

export default {
  id: 'ufdata',
  name: FORMAT,
  extensions: ['ufdata'],
  beta: true,
  parse(bytes, fileName = '') {
    let source;
    try { source = JSON.parse(decodeText(bytes)); } catch (error) { throw new Error(`Invalid UtaFormatix data: ${error.message}`); }
    const project = source?.project;
    if (!project || typeof project !== 'object' || !Array.isArray(project.tracks)) throw new Error('Invalid UtaFormatix data: expected a project with a tracks array.');
    const warnings = Number(source.formatVersion) > SUPPORTED_VERSION
      ? [`UtaFormatix data version ${source.formatVersion} is newer than the supported version ${SUPPORTED_VERSION}; unknown fields were ignored.`] : [];
    // Positions already exclude measurePrefix, so it needs no handling here.
    const tracks = project.tracks.map((track, index) => ({
      id: `ufdata-track-${index + 1}`,
      name: track?.name || `Track ${index + 1}`,
      notes: list(track?.notes).map(note => ({
        onset: ticksToBlicks(note?.tickOn, TICKS_PER_QUARTER),
        duration: ticksToBlicks(note?.tickOff - note?.tickOn, TICKS_PER_QUARTER),
        pitch: note?.key,
        lyrics: note?.lyric === '-' ? EXTENSION_LYRIC : String(note?.lyric ?? '')
      }))
    }));
    const tempos = list(project.tempos).map(tempo => ({ position: ticksToBlicks(tempo?.tickPosition, TICKS_PER_QUARTER), bpm: tempo?.bpm }));
    const meters = list(project.timeSignatures).map(signature => ({ index: signature?.measurePosition, numerator: signature?.numerator, denominator: signature?.denominator }));
    return createProject({ format: FORMAT, title: project.name || baseName(fileName), version: source.formatVersion ?? null, tracks, tempos, meters, warnings });
  }
};
