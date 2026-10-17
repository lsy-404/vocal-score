// Score time for playback. The score model counts in divisions per quarter; its tempo map turns them into seconds, so
// the piano plays the notes as written and the playhead finds its place on the page from the same clock.

/** Seconds from divisions and back, over the model's tempo changes; ends where the last bar ends. */
export function tempoMap(model) {
  const divisions = Number(model?.divisions) > 0 ? Number(model.divisions) : 1;
  const changes = (model?.tempos ?? [])
    .filter(tempo => Number.isFinite(tempo?.position) && Number(tempo?.bpm) > 0)
    .map(tempo => ({tick: Math.max(0, tempo.position), bpm: Number(tempo.bpm)}))
    .sort((a, b) => a.tick - b.tick);
  if (!changes.length || changes[0].tick > 0) changes.unshift({tick: 0, bpm: changes[0]?.bpm ?? 120});
  const segments = [];
  let seconds = 0;
  for (const [index, change] of changes.entries()) {
    if (index && change.tick === segments.at(-1).tick) { segments.at(-1).perTick = 60 / (change.bpm * divisions); continue; }
    if (index) seconds += (change.tick - segments.at(-1).tick) * segments.at(-1).perTick;
    segments.push({tick: change.tick, seconds, perTick: 60 / (change.bpm * divisions)});
  }
  const segmentAt = (key, value) => {
    let low = 0, high = segments.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >>> 1;
      if (segments[middle][key] <= value) low = middle;
      else high = middle - 1;
    }
    return segments[low];
  };
  const toSeconds = tick => { const segment = segmentAt('tick', tick); return segment.seconds + (tick - segment.tick) * segment.perTick; };
  const toTick = time => { const segment = segmentAt('seconds', time); return segment.tick + (time - segment.seconds) / segment.perTick; };
  const end = model?.measures?.at(-1)?.end ?? 0;
  return {divisions, toSeconds, toTick, duration: toSeconds(end)};
}

/** The pitched notes of the score in seconds, by start. Percussion parts are left out: their pitches only place them. */
export function playbackNotes(model, map = tempoMap(model)) {
  const notes = [];
  for (const [part, track] of (model?.tracks ?? []).entries()) {
    if (track.percussion) continue;
    for (const note of track.notes ?? []) {
      if (!Number.isFinite(note.pitch) || !(note.end > note.start)) continue;
      notes.push({start: map.toSeconds(note.start), end: map.toSeconds(note.end), pitch: note.pitch, part});
    }
  }
  return notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
}

/** Index of the first note that is still sounding at the time (notes are sorted by start). */
export function firstNoteFrom(notes, time) {
  let low = 0, high = notes.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (notes[middle].start < time) low = middle + 1;
    else high = middle;
  }
  // Notes that began earlier may still sound; long notes are rare, so a short walk back finds them.
  let index = low;
  for (let back = low - 1; back >= 0 && low - back <= 64; back -= 1) if (notes[back].end > time) index = back;
  return index;
}

// Bars on the page. Each engraved page carries an invisible rectangle per bar with its start and end in divisions and
// where each onset sits across it; reading the rectangles back gives page fractions, like the editable text targets.
export const PLAYBACK_MARK_CLASS = 'playback-mark';

/** Writes a bar's mark into an SVG page. Points are [tick, x] in the page's own units; x outside the bar is clamped. */
export function addPlaybackMark(svg, {start, end, left, right, top, bottom, points}) {
  const width = right - left;
  if (!(width > 0) || !(bottom > top) || !(end > start)) return null;
  const rect = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'rect');
  const fractions = [...points]
    .filter(([tick, x]) => tick >= start && tick < end && Number.isFinite(x))
    .map(([tick, x]) => `${Math.round(tick * 1000) / 1000}:${Math.round(Math.min(1, Math.max(0, (x - left) / width)) * 10000) / 10000}`);
  for (const [name, value] of Object.entries({class: PLAYBACK_MARK_CLASS, x: left, y: top, width, height: bottom - top, fill: 'none', stroke: 'none', 'pointer-events': 'none', 'data-play-start': start, 'data-play-end': end, 'data-play-points': fractions.join(' ')})) rect.setAttribute(name, String(value));
  svg.appendChild(rect);
  return rect;
}

/** Bars as page fractions, from the marks in each page, sorted by start. */
export function collectPlaybackMarks(pages, toPage) {
  const marks = [];
  Array.from(pages ?? []).forEach((svg, pageIndex) => {
    for (const node of svg.querySelectorAll(`.${PLAYBACK_MARK_CLASS}`)) {
      const rectangle = toPage(node.getBoundingClientRect(), svg.getBoundingClientRect());
      const start = Number(node.getAttribute('data-play-start')), end = Number(node.getAttribute('data-play-end'));
      if (!rectangle || !(end > start)) continue;
      const points = (node.getAttribute('data-play-points') || '').split(' ').filter(Boolean).map(pair => pair.split(':').map(Number)).filter(pair => pair.every(Number.isFinite));
      marks.push({pageNumber: pageIndex + 1, start, end, ...rectangle, points: barPoints(start, end, points)});
    }
  });
  return marks.sort((a, b) => a.start - b.start || a.pageNumber - b.pageNumber);
}

// A bar's path for the playhead: from where its notes begin to the barline, through each onset in time order.
function barPoints(start, end, points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const path = [];
  for (const [tick, x] of sorted) {
    if (path.at(-1)?.[0] === tick) continue;
    if (path.length && x < path.at(-1)[1]) continue;
    path.push([tick, x]);
  }
  if (!path.length || path[0][0] > start) path.unshift([start, path.length ? Math.min(path[0][1], 0.04) : 0.04]);
  path.push([end, 1]);
  return path;
}

// The last item whose key is at or before the value (items sorted by key).
function lastAtOrBefore(items, value, key) {
  let low = 0, high = items.length - 1;
  if (high < 0) return -1;
  while (low < high) {
    const middle = (low + high + 1) >>> 1;
    if (key(items[middle]) <= value) low = middle;
    else high = middle - 1;
  }
  return low;
}

// Tangents for a monotone cubic through the points (Fritsch–Carlson): the playhead's speed changes smoothly from one
// note to the next instead of jumping at every onset, and it never runs backwards or past a note.
function monotoneTangents(points) {
  const slopes = points.slice(1).map((point, index) => {
    const span = point[0] - points[index][0];
    return span > 0 ? (point[1] - points[index][1]) / span : 0;
  });
  const last = points.length - 1;
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0] ?? 0;
    if (index === last) return slopes[last - 1] ?? 0;
    return slopes[index - 1] * slopes[index] <= 0 ? 0 : (slopes[index - 1] + slopes[index]) / 2;
  });
  slopes.forEach((slope, index) => {
    if (slope === 0) { tangents[index] = tangents[index + 1] = 0; return; }
    const a = tangents[index] / slope, b = tangents[index + 1] / slope, size = a * a + b * b;
    if (size > 9) {
      const scale = 3 / Math.sqrt(size);
      tangents[index] = scale * a * slope;
      tangents[index + 1] = scale * b * slope;
    }
  });
  return tangents;
}

/**
 * Rows of bars (one per system) with the playhead's path across each, in page fractions. Within a row the path runs
 * from the last note of one bar straight on to the first note of the next, so it does not stop at barlines.
 */
export function playbackRows(marks) {
  const rows = [];
  for (const mark of marks) {
    const points = mark.points.map(([tick, fraction]) => [tick, mark.x + fraction * mark.width]);
    const row = rows.at(-1);
    if (row && row.pageNumber === mark.pageNumber && Math.abs(row.y - mark.y) < 0.002 && mark.start >= row.end - 1e-6) {
      row.points.pop();
      for (const point of points) {
        const previous = row.points.at(-1);
        if (point[0] > previous[0] && point[1] >= previous[1]) row.points.push(point);
      }
      row.end = mark.end;
      row.height = Math.max(row.height, mark.height);
    } else {
      rows.push({pageNumber: mark.pageNumber, y: mark.y, height: mark.height, start: mark.start, end: mark.end, points});
    }
  }
  for (const row of rows) row.tangents = monotoneTangents(row.points);
  return rows;
}

/** Where the playhead stands at a tick: the page, x as a page fraction and the row's top and height. */
export function playheadAt(rows, tick) {
  const rowIndex = lastAtOrBefore(rows, Math.max(0, tick), row => row.start);
  if (rowIndex < 0) return null;
  const row = rows[rowIndex], points = row.points;
  const at = Math.min(row.end, Math.max(row.start, tick));
  const index = Math.min(points.length - 2, Math.max(0, lastAtOrBefore(points, at, point => point[0])));
  const [t0, x0] = points[index], [t1, x1] = points[index + 1] ?? points[index];
  const span = t1 - t0;
  let x = x0;
  if (span > 0) {
    // Cubic Hermite between the two notes.
    const s = Math.min(1, Math.max(0, (at - t0) / span)), s2 = s * s, s3 = s2 * s;
    x = (2 * s3 - 3 * s2 + 1) * x0 + (s3 - 2 * s2 + s) * span * row.tangents[index] + (3 * s2 - 2 * s3) * x1 + (s3 - s2) * span * row.tangents[index + 1];
  }
  return {pageNumber: row.pageNumber, x, y: row.y, height: row.height, start: row.start};
}

/** The tick under a point on a page (page fractions), or null when no bar is near it. */
export function tickAtPoint(marks, pageNumber, x, y) {
  const onPage = marks.filter(mark => mark.pageNumber === pageNumber);
  if (!onPage.length) return null;
  // The bar row nearest the point, then the bar across it.
  const distance = mark => (y < mark.y ? mark.y - y : y > mark.y + mark.height ? y - mark.y - mark.height : 0);
  const nearest = Math.min(...onPage.map(distance));
  if (nearest > 0.08) return null;
  const row = onPage.filter(mark => distance(mark) === nearest);
  const mark = row.find(item => x >= item.x && x <= item.x + item.width) ?? (x < row[0].x ? row[0] : row.at(-1));
  const across = Math.min(1, Math.max(0, (x - mark.x) / mark.width));
  const points = mark.points;
  let index = 0;
  while (index < points.length - 2 && points[index + 1][1] <= across) index += 1;
  const [t0, x0] = points[index], [t1, x1] = points[index + 1] ?? points[index];
  if (across <= x0) return t0;
  return x1 > x0 ? t0 + (t1 - t0) * Math.min(1, (across - x0) / (x1 - x0)) : t0;
}

/** m:ss for the transport. */
export function formatTime(seconds) {
  const whole = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
