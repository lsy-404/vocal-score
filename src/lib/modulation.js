// Finds key-signature changes from the notes themselves. Each measure is scored against the twelve
// diatonic collections by how long its notes sit outside the collection; a dynamic programme then picks
// the cheapest sequence of collections, paying a penalty for every change, so that passing accidentals and
// borrowed chords stay accidentals while a sustained modulation gets its own key signature.

const COLLECTIONS = Array.from({ length: 12 }, (_, index) => {
  const fifths = index - 6;
  const tonic = ((fifths * 7) % 12 + 12) % 12;
  return { fifths, pcs: new Set([0, 2, 4, 5, 7, 9, 11].map(step => (step + tonic) % 12)) };
});

function collectionIndex(fifths) {
  const tonic = ((Number(fifths) * 7) % 12 + 12) % 12;
  return COLLECTIONS.findIndex(collection => ((collection.fifths * 7) % 12 + 12) % 12 === tonic);
}

function measureCosts(measures, notes) {
  const costs = measures.map(() => new Float64Array(12));
  const starts = measures.map(measure => measure.start);
  for (const note of notes) {
    let low = 0, high = starts.length;
    while (low < high) { const middle = (low + high) >>> 1; if (starts[middle] <= note.start) low = middle + 1; else high = middle; }
    const pc = ((note.pitch % 12) + 12) % 12;
    for (let index = Math.max(0, low - 1); index < measures.length && measures[index].start < note.end; index += 1) {
      const overlap = Math.min(note.end, measures[index].end) - Math.max(note.start, measures[index].start);
      if (overlap <= 0) continue;
      for (let key = 0; key < 12; key += 1) if (!COLLECTIONS[key].pcs.has(pc)) costs[index][key] += overlap;
    }
  }
  return costs;
}

function cheapestPath(costs, initial, penalty) {
  const back = costs.map(() => new Int8Array(12));
  let previous = Array.from({ length: 12 }, (_, key) => costs[0][key] + (key === initial ? 0 : 1e-6));
  for (let index = 1; index < costs.length; index += 1) {
    let best = 0;
    for (let key = 1; key < 12; key += 1) if (previous[key] < previous[best]) best = key;
    const next = new Array(12);
    for (let key = 0; key < 12; key += 1) {
      const switched = previous[best] + penalty;
      if (previous[key] <= switched) { next[key] = previous[key] + costs[index][key]; back[index][key] = key; }
      else { next[key] = switched + costs[index][key]; back[index][key] = best; }
    }
    previous = next;
  }
  let state = 0;
  for (let key = 1; key < 12; key += 1) if (previous[key] < previous[state]) state = key;
  const path = new Array(costs.length);
  for (let index = costs.length - 1; index >= 0; index -= 1) { path[index] = state; state = back[index][state]; }
  return path;
}

function segmentsOf(path) {
  const segments = [];
  path.forEach((key, index) => {
    if (segments.at(-1)?.key === key) segments.at(-1).end = index + 1;
    else segments.push({ key, start: index, end: index + 1 });
  });
  return segments;
}

// Short segments are absorbed by whichever neighbour fits their notes better.
function absorbShortSegments(segments, costs, minMeasures) {
  const cost = (segment, key) => { let total = 0; for (let index = segment.start; index < segment.end; index += 1) total += costs[index][key]; return total; };
  for (let changed = true; changed && segments.length > 1;) {
    changed = false;
    const shortest = segments.reduce((best, segment, index) => (segment.end - segment.start < minMeasures && (best < 0 || segment.end - segment.start < segments[best].end - segments[best].start) ? index : best), -1);
    if (shortest < 0) break;
    const segment = segments[shortest], before = segments[shortest - 1], after = segments[shortest + 1];
    const target = !after || (before && cost(segment, before.key) <= cost(segment, after.key)) ? before : after;
    if (target === before) before.end = segment.end; else after.start = segment.start;
    segments.splice(shortest, 1);
    for (let index = segments.length - 1; index > 0; index -= 1) {
      if (segments[index].key === segments[index - 1].key) { segments[index - 1].end = segments[index].end; segments.splice(index, 1); }
    }
    changed = true;
  }
  return segments;
}

/**
 * @param measures [{start, end}] in score ticks
 * @param notes [{start, end, pitch}] in score ticks, all voices together
 * @returns [{measureIndex, fifths}] for every measure after the first that starts a new key signature
 */
export function detectKeyChanges(measures, notes, { initialFifths = 0, divisions = 16, minMeasures = 4 } = {}) {
  if (measures.length < minMeasures * 2 || !notes.length) return [];
  const costs = measureCosts(measures, notes);
  const initial = collectionIndex(initialFifths);
  const path = cheapestPath(costs, initial, divisions * 4);
  const segments = absorbShortSegments(segmentsOf(path), costs, minMeasures);
  const first = segments[0].key;
  const spell = key => {
    if (key === first || key === initial) return Math.trunc(initialFifths);
    const fifths = COLLECTIONS[key].fifths;
    return fifths === -6 && initialFifths > 0 ? 6 : fifths;
  };
  const changes = [];
  let current = Math.trunc(initialFifths);
  for (const segment of segments.slice(1)) {
    const fifths = spell(segment.key);
    if (fifths !== current) changes.push({ measureIndex: segment.start, fifths });
    current = fifths;
  }
  return changes;
}
