import {PIANO_SAMPLE_RATE, renderPianoTone} from './piano.js';

// Renders piano tones off the page; the buffers are handed back without copying.
self.onmessage = ({data}) => {
  try {
    const tones = data.pitches.map(pitch => renderPianoTone(pitch, PIANO_SAMPLE_RATE));
    self.postMessage({id: data.id, pitches: data.pitches, tones}, tones.map(tone => tone.buffer));
  } catch (error) {
    self.postMessage({id: data.id, error: String(error?.message || error)});
  }
};
