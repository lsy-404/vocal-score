import { getPaperDimensions } from './pdf.js';

function setTarget(node, note) {
  if (!node || !note) return;
  node.setAttribute('data-edit-kind', 'lyric');
  node.setAttribute('data-track-id', String(note.sourceTrackId));
  node.setAttribute('data-note-index', String(note.sourceNoteIndex));
}

function noteIndex(track) {
  const index = new Map();
  for (const note of track.notes ?? []) {
    const key = `${note.voice}:${note.pitch}`;
    const bucket = index.get(key) ?? [];
    bucket.push(note);
    index.set(key, bucket);
  }
  for (const bucket of index.values()) bucket.sort((a, b) => a.start - b.start || a.end - b.end);
  return index;
}

function findSourceNote(index, voice, pitch, start) {
  const bucket = index.get(`${voice}:${pitch}`) ?? [];
  let low = 0;
  let high = bucket.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (bucket[middle].start <= start + 1e-6) low = middle + 1;
    else high = middle;
  }
  const note = bucket[low - 1];
  return note && note.end > start - 1e-6 ? note : null;
}

function tagLyricTargets(osmd, model) {
  if (!model?.tracks?.length || !Array.isArray(model.measures)) return;
  const measures = osmd.graphic?.measureList ?? osmd.graphic?.MeasureList;
  if (!Array.isArray(measures)) return;
  const trackIndexes = model.tracks.map(noteIndex);
  measures.forEach((measureStaves) => {
    if (!Array.isArray(measureStaves)) return;
    measureStaves.forEach((graphicalMeasure, staffIndex) => {
      const instrumentId = graphicalMeasure?.ParentStaff?.ParentInstrument?.IdString;
      const partNumber = /^P(\d+)$/u.exec(String(instrumentId ?? ''));
      const instrumentIndex = partNumber ? Number(partNumber[1]) - 1 : -1;
      const partIndex = instrumentIndex >= 0 && instrumentIndex < model.tracks.length
        ? instrumentIndex
        : measureStaves.length === model.tracks.length ? staffIndex : -1;
      const track = model.tracks[partIndex];
      if (!track) return;
      const index = trackIndexes[partIndex];
      for (const entry of graphicalMeasure?.staffEntries ?? []) {
        for (const graphicalVoice of entry.graphicalVoiceEntries ?? []) {
          for (const graphicalNote of graphicalVoice.notes ?? []) {
            const source = graphicalNote.sourceNote;
            const pitch = (source?.Pitch?.getHalfTone?.() ?? NaN) + 12;
            const voice = source?.ParentVoiceEntry?.ParentVoice?.VoiceId;
            const timestamp = source?.getAbsoluteTimestamp?.()?.RealValue;
            if (!Number.isFinite(pitch) || !Number.isFinite(timestamp)) continue;
            const start = timestamp * model.divisions * 4;
            const note = findSourceNote(index, voice, pitch, start);
            if (!note) continue;
            for (const node of graphicalNote.getLyricsSVGs?.() ?? []) setTarget(node, note);
          }
        }
      }
    });
  });
}

// Part labels are matched by their drawn text: the part name, or the label it was given (name plus voice bank).
function tagPartNames(osmd, model, partLabels) {
  if (!model?.tracks?.length) return;
  const tracksByName = new Map();
  for (const [index, track] of model.tracks.entries()) {
    const name = String(partLabels?.[index] ?? track.name ?? '').trim();
    if (!name) continue;
    const matches = tracksByName.get(name) ?? [];
    matches.push(track);
    tracksByName.set(name, matches);
  }
  const pages = osmd.graphic?.MusicPages ?? osmd.graphic?.musicPages ?? [];
  for (const page of pages) {
    for (const system of page.MusicSystems ?? page.musicSystems ?? []) {
      for (const label of system.Labels ?? system.labels ?? []) {
        const matches = tracksByName.get(label.Label?.text?.trim());
        if (matches?.length !== 1) continue;
        for (const node of label.SVGNode?.querySelectorAll?.('text') ?? []) {
          node.setAttribute('data-edit-kind', 'track-name');
          node.setAttribute('data-track-id', String(matches[0].id));
        }
      }
    }
  }
}

// OSMD reserves a lyric row only in systems that show lyric text, so a melisma carried into a new system had its
// extender drawn through the notes or into the staff below. Systems break only at barlines: an invisible syllable on a
// bar's first note, when that note only continues a melisma, keeps the row. Only the engraved copy changes.
export function keepLyricRows(xml) {
  let doc;
  try { doc = new DOMParser().parseFromString(xml, 'application/xml'); } catch { return xml; }
  if (doc.getElementsByTagName('parsererror').length) return xml;
  let changed = false;
  for (const measure of Array.from(doc.getElementsByTagName('measure'))) {
    const first = Array.from(measure.childNodes).find(node => node.nodeType === 1 && node.localName === 'note' && !node.getElementsByTagName('grace').length);
    if (!first || first.getElementsByTagName('rest').length) continue;
    const lyric = Array.from(first.childNodes).find(node => node.nodeType === 1 && node.localName === 'lyric');
    if (!lyric || lyric.getElementsByTagName('text').length || !lyric.getElementsByTagName('extend').length) continue;
    const text = doc.createElement('text');
    text.textContent = '\u00a0';
    lyric.insertBefore(text, lyric.firstChild);
    changed = true;
  }
  return changed ? new XMLSerializer().serializeToString(doc) : xml;
}

export async function renderStaffScore(container, xml, {
  paperSize = 'a4',
  orientation = 'portrait',
  showMeasureNumbers = true,
  fontFamily = 'Times New Roman, SimSun, serif',
  lyricFontSize = 14,
  model,
  partLabels,
} = {}) {
  if (!container?.replaceChildren) throw new TypeError('A DOM container is required.');
  if (typeof xml !== 'string') throw new TypeError('MusicXML must be a string.');
  const Constructor = globalThis.opensheetmusicdisplay?.OpenSheetMusicDisplay;
  if (!Constructor) throw new Error('OpenSheetMusicDisplay is unavailable.');
  const osmd = new Constructor(container, {
    autoResize: false,
    backend: 'svg',
    drawTitle: false,
    drawSubtitle: false,
    drawComposer: false,
    drawPartNames: true,
    drawMeasureNumbers: Boolean(showMeasureNumbers),
    drawingParameters: 'compacttight',
  });
  const dimensions = getPaperDimensions(paperSize, orientation);
  osmd.setCustomPageFormat(dimensions.width, dimensions.height);
  osmd.EngravingRules.DefaultFontFamily = fontFamily;
  osmd.EngravingRules.VexFlowTextFontFamily = fontFamily;
  osmd.EngravingRules.LyricsHeight = Math.max(10, Math.min(24, Number(lyricFontSize) || 14)) / 10;
  osmd.EngravingRules.RenderMeasureNumbersOnlyAtSystemStart = false;
  // Triplet numbers follow the score's own tuplet marks (bracket, number alone or simile), not OSMD's repetition limit.
  osmd.EngravingRules.TupletNumberLimitConsecutiveRepetitions = false;
  await osmd.load(keepLyricRows(xml));
  osmd.Zoom = 1;
  osmd.render();
  tagLyricTargets(osmd, model);
  tagPartNames(osmd, model, partLabels);
  return { osmd };
}
