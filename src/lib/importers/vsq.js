// Format handling adapted from UtaFormatix3 (https://github.com/sdercolin/utaformatix3), Apache License 2.0, Copyright 2020 sdercolin.
import { parseVsqMidi } from './vsq-text.js';

export default {
  id: 'vsq',
  name: 'VOCALOID 2',
  extensions: ['vsq'],
  beta: true,
  parse(bytes, fileName) {
    return parseVsqMidi(bytes, fileName, { format: 'VOCALOID 2', label: 'VSQ file' });
  }
};
