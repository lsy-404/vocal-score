// A piano voice synthesized from how a struck string sounds, so the app ships no samples. A stiff string's partials sit
// a little sharp of the harmonic series, the higher ones die away faster, the strings of one note drift against each
// other, and the sound drops quickly after the strike before its long, quiet tail. A felt hammer adds a short thump.
// Each pitch is rendered once into a buffer that playback reuses; the key's release is applied when the note is played.

/** Sample rate the tones are rendered at; Web Audio resamples on playback. Partials stay below 10 kHz. */
export const PIANO_SAMPLE_RATE = 24000;

const frequency = pitch => 440 * 2 ** ((pitch - 69) / 12);

/** How long a pitch's buffer lasts: bass strings ring for seconds, the top of the keyboard for a moment. */
export function pianoToneSeconds(pitch) {
  return Math.min(4, Math.max(1.2, 4 - (pitch - 48) * 0.06));
}

// Small deterministic noise, so a pitch always renders the same buffer.
function noise(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 0x80000000 - 1;
  };
}

/** One piano note at mezzo-forte, peak about 0.5, as mono samples. */
export function renderPianoTone(pitch, sampleRate = PIANO_SAMPLE_RATE, seconds = pianoToneSeconds(pitch)) {
  const length = Math.max(1, Math.round(seconds * sampleRate));
  const out = new Float32Array(length);
  const f0 = frequency(pitch);
  // Stiffness grows toward the treble; the wound bass strings are the least stiff.
  const stiffness = Math.min(0.004, Math.max(0.00005, 0.0001 * 2 ** ((pitch - 48) / 14)));
  // The sound's two decay stages, longest in the bass.
  const ring = Math.min(3.2, Math.max(0.35, 1.6 * 2 ** (-(pitch - 60) / 20)));
  const limit = Math.min(9500, sampleRate * 0.45);
  const partials = Math.min(28, Math.floor(limit / f0));
  for (let n = 1; n <= partials; n += 1) {
    const fn = n * f0 * Math.sqrt(1 + stiffness * n * n);
    if (fn >= limit) break;
    // The hammer strikes about an eighth along the string, which hushes partials near multiples of eight.
    const amplitude = Math.abs(Math.sin(Math.PI * n / 8.3)) / n ** 1.05 * Math.exp(-(n - 1) * 0.06);
    const slow = ring / (1 + 0.32 * (n - 1)), fast = slow / 5;
    const fastStep = Math.exp(-1 / (fast * sampleRate)), slowStep = Math.exp(-1 / (slow * sampleRate));
    // Two strings a cent or so apart beat slowly against each other.
    for (const [detune, share] of [[0.9994, 0.5], [1.0006, 0.5]]) {
      const omega = 2 * Math.PI * fn * detune / sampleRate;
      const c = Math.cos(omega), s = Math.sin(omega);
      let x = Math.cos(n * 1.7 + detune * 3), y = Math.sin(n * 1.7 + detune * 3);
      let early = amplitude * share * 0.72, late = amplitude * share * 0.28;
      for (let i = 0; i < length; i += 1) {
        out[i] += (early + late) * y;
        const nx = x * c - y * s;
        y = x * s + y * c;
        x = nx;
        early *= fastStep;
        late *= slowStep;
      }
    }
  }
  // The felt's thump: low-passed noise over the first few milliseconds.
  const random = noise(pitch * 7919 + 17);
  const thumpLength = Math.min(length, Math.round(sampleRate * 0.03));
  let low = 0;
  const smoothing = Math.exp(-2 * Math.PI * Math.min(4000, f0 * 6) / sampleRate);
  for (let i = 0; i < thumpLength; i += 1) {
    low = low * smoothing + random() * (1 - smoothing);
    out[i] += low * 0.5 * Math.exp(-i / (sampleRate * 0.006));
  }
  // A quick onset so the first sample does not click.
  const attack = Math.max(1, Math.round(sampleRate * 0.002));
  for (let i = 0; i < Math.min(attack, length); i += 1) out[i] *= i / attack;
  // And a fade at the buffer's end, for the few notes held longer than the buffer.
  const tail = Math.min(length, Math.round(sampleRate * 0.08));
  for (let i = 0; i < tail; i += 1) out[length - 1 - i] *= i / tail;
  let peak = 0;
  for (let i = 0; i < length; i += 1) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0) for (let i = 0; i < length; i += 1) out[i] *= 0.5 / peak;
  return out;
}
