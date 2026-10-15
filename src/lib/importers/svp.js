import { parseSvp } from '../converter.js';
import { decodeText } from './model.js';

export default {
  id: 'svp',
  name: 'Synthesizer V Studio',
  extensions: ['svp'],
  parse(bytes, fileName) {
    return { format: 'Synthesizer V Studio', ...parseSvp(decodeText(bytes), fileName) };
  }
};
