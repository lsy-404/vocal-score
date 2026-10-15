// Format handling adapted from UtaFormatix3 (https://github.com/sdercolin/utaformatix3), Apache License 2.0, Copyright 2020 sdercolin.
import { isVsqMidi, parseVsqMidi } from './vsq-text.js';

export default {
  id: 'vocaloid-mid',
  name: 'VOCALOID MIDI',
  extensions: ['mid', 'midi'],
  beta: true,
  // VOCALOID 1 exports MIDI files that carry the VSQ text body; plain MIDI files are left to the MIDI importer.
  detect: bytes => isVsqMidi(bytes),
  parse(bytes, fileName) {
    return parseVsqMidi(bytes, fileName, { format: 'VOCALOID MIDI', label: 'VOCALOID MIDI file' });
  }
};
