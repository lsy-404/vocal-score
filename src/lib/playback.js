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

function markAt(marks, tick) {
  let low = 0, high = marks.length - 1;
  if (high < 0) return null;
  while (low < high) {
    const middle = (low + high + 1) >>> 1;
    if (marks[middle].start <= tick) low = middle;
    else high = middle - 1;
  }
  return marks[low];
}

/** Where the playhead stands at a tick: the page, x as a page fraction and the bar's top and height. */
export function playheadAt(marks, tick) {
  const mark = markAt(marks, Math.max(0, tick));
  if (!mark) return null;
  const clamped = Math.min(mark.end, Math.max(mark.start, tick));
  const points = mark.points;
  let index = 0;
  while (index < points.length - 2 && points[index + 1][0] <= clamped) index += 1;
  const [t0, x0] = points[index], [t1, x1] = points[index + 1] ?? points[index];
  const fraction = t1 > t0 ? (clamped - t0) / (t1 - t0) : 0;
  return {pageNumber: mark.pageNumber, x: mark.x + (x0 + (x1 - x0) * fraction) * mark.width, y: mark.y, height: mark.height, start: mark.start};
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
