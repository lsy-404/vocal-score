const SVG_NS = "http://www.w3.org/2000/svg";
const DEGREE = ["1", "2", "3", "4", "5", "6", "7"];
const NATURAL_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const FIFTHS_MAJOR = ["C♭", "G♭", "D♭", "A♭", "E♭", "B♭", "F", "C", "G", "D", "A", "E", "B", "F♯", "C♯"];
const FIFTHS_MINOR = ["A♭", "E♭", "B♭", "F", "C", "G", "D", "A", "E", "B", "F♯", "C♯", "G♯", "D♯", "A♯"];

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (parent) parent.append(node);
  return node;
}

function text(parent, value, attrs = {}) {
  const node = el("text", attrs, parent);
  node.textContent = value;
  return node;
}

function child(node, name) {
  return Array.from(node.children).find((item) => item.localName === name) ?? null;
}

function children(node, name) {
  return Array.from(node.children).filter((item) => item.localName === name);
}

function number(node, fallback = 0) {
  const parsed = Number(node?.textContent);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pitchClass(name) {
  const match = name.match(/^([A-G])([♯♭]?)$/);
  return match ? (NATURAL_PC[match[1]] + (match[2] === "♯" ? 1 : match[2] === "♭" ? -1 : 0) + 12) % 12 : 0;
}

function parsePitch(note, tonicName, minor = false) {
  const pitch = child(note, "pitch");
  if (!pitch) return null;
  const step = child(pitch, "step")?.textContent?.trim();
  const octave = number(child(pitch, "octave"), 4);
  if (!(step in NATURAL_PC)) return null;
  const alter = number(child(pitch, "alter"));
  const midi = (octave + 1) * 12 + NATURAL_PC[step] + alter;
  const tonic = pitchClass(tonicName);
  const delta = ((midi % 12) - tonic + 12) % 12;
  const scale = minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  let degree = 0;
  let accidental = "";
  let distance = 99;
  for (let i = 0; i < scale.length; i += 1) {
    let d = delta - scale[i];
    if (d > 6) d -= 12;
    if (d < -6) d += 12;
    if (Math.abs(d) < distance) {
      distance = Math.abs(d);
      degree = i;
      accidental = d === 0 ? "" : d > 0 ? "♯" : "♭";
    }
  }
  const tonicLetter = tonicName[0];
  const letterOrder = "CDEFGAB";
  const octaveShift = octave - 4 - (letterOrder.indexOf(step) < letterOrder.indexOf(tonicLetter) ? 1 : 0);
  return { label: `${accidental}${DEGREE[degree]}`, octaveShift, midi };
}

function lyricText(note) {
  const lyric = child(note, "lyric");
  if (!lyric) return "";
  const syllabic = child(lyric, "syllabic")?.textContent;
  const parts = children(lyric, "text").map((part) => part.textContent ?? "");
  const joined = parts.join("");
  const extend = child(lyric, "extend");
  if (extend && !joined) return "‿";
  if (syllabic === "begin" || syllabic === "middle") return `${joined}‐`;
  return joined;
}

function rhythmLines(type) {
  return ({ eighth: 1, "16th": 2, "32nd": 3, "64th": 4 })[type] ?? 0;
}

function parseMeasure(measure, divisions, warnings, partName, tonic, minor) {
  const events = [];
  let cursor = 0;
  let maxTime = 0;
  let localDivisions = divisions;
  let hasBackup = false;
  for (const item of Array.from(measure.children)) {
    if (item.localName === "attributes") {
      localDivisions = number(child(item, "divisions"), localDivisions) || localDivisions;
    } else if (item.localName === "backup") {
      hasBackup = true;
      cursor -= number(child(item, "duration")) / localDivisions;
    } else if (item.localName === "forward") {
      cursor += number(child(item, "duration")) / localDivisions;
      maxTime = Math.max(maxTime, cursor);
    } else if (item.localName === "note") {
      const duration = number(child(item, "duration"), 1) / localDivisions;
      const chord = Boolean(child(item, "chord"));
      const rest = Boolean(child(item, "rest"));
      const type = child(item, "type")?.textContent?.trim() ?? "quarter";
      const dots = children(item, "dot").length;
      const pitch = rest ? null : parsePitch(item, tonic, minor);
      events.push({
        x: cursor,
        duration,
        rest,
        type,
        dots,
        pitch,
        lyric: lyricText(item),
        ties: [...children(item, "tie"), ...children(child(item, "notations") ?? document.createElement("div"), "tied")].map((tie) => tie.getAttribute("type")),
        chord,
      });
      if (!chord) cursor += duration;
      maxTime = Math.max(maxTime, cursor);
    }
  }
  if (hasBackup) throw new Error(`${partName}: MusicXML backup timing indicates multiple voices in one part, which numbered-score rendering does not support.`);
  return { events, duration: maxTime, divisions: localDivisions };
}

function keyTonic(attributes) {
  const key = child(attributes, "key");
  if (!key) return { tonic: "C", minor: false };
  const fifths = Math.max(-7, Math.min(7, number(child(key, "fifths"))));
  const mode = child(key, "mode")?.textContent?.trim().toLowerCase();
  return { tonic: (mode === "minor" ? FIFTHS_MINOR : FIFTHS_MAJOR)[fifths + 7], minor: mode === "minor" };
}

function readMeasureChanges(measure, state) {
  const changes = [];
  const annotations = [];
  let divisions = state.divisions || 1;
  let cursor = 0;
  for (const item of Array.from(measure?.children ?? [])) {
    if (item.localName === "attributes") {
      divisions = number(child(item, "divisions"), divisions) || divisions;
      const key = child(item, "key");
      if (key) {
        const next = keyTonic(item);
        if (next.tonic !== state.tonic || next.minor !== state.minor) {
          state.tonic = next.tonic;
          state.minor = next.minor;
          changes.push(`1=${state.tonic}`);
        }
      }
      const time = child(item, "time");
      if (time) {
        const beats = child(time, "beats")?.textContent?.trim() || "4";
        const beatType = child(time, "beat-type")?.textContent?.trim() || "4";
        if (beats !== state.beats || beatType !== state.beatType) {
          state.beats = beats;
          state.beatType = beatType;
          changes.push(`${beats}/${beatType}`);
        }
      }
    } else if (item.localName === "direction") {
      const sound = child(item, "sound");
      const metronome = item.querySelector?.("metronome per-minute");
      const tempo = sound?.getAttribute("tempo") || metronome?.textContent?.trim();
      if (tempo && tempo !== state.tempo) {
        state.tempo = tempo;
        changes.push(`♩=${tempo}`);
      }
      const words = item.querySelector?.("direction-type words");
      if (words?.textContent?.trim()) {
        const offset = number(child(item, "offset")) / divisions;
        annotations.push({
          text: words.textContent.trim(),
          ratio: Math.max(0, Math.min(1, (cursor + offset) / (state.measureDuration || 1))),
          fontSize: Math.max(8, Math.min(24, number(words.getAttribute("font-size"), 10))),
        });
      }
    } else if (item.localName === "note") {
      const duration = number(child(item, "duration"), 1) / divisions;
      if (!child(item, "chord")) cursor += duration;
    } else if (item.localName === "backup") {
      cursor -= number(child(item, "duration")) / divisions;
    } else if (item.localName === "forward") {
      cursor += number(child(item, "duration")) / divisions;
    }
  }
  return { changes, annotations };
}

function getSongData(xml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror") || doc.documentElement.localName !== "score-partwise") {
    throw new Error("Expected a valid MusicXML partwise document.");
  }
  const parts = children(doc.documentElement, "part");
  if (!parts.length) throw new Error("MusicXML must contain at least one part.");
  const partList = child(doc.documentElement, "part-list");
  const names = new Map(children(partList, "score-part").map((part) => [part.getAttribute("id"), child(part, "part-name")?.textContent?.trim()]));
  const firstAttributes = children(parts[0], "measure").flatMap((measure) => children(measure, "attributes"))[0];
  const firstMeasure = children(parts[0], "measure")[0];
  const tempo = firstMeasure?.querySelector("sound[tempo]")?.getAttribute("tempo") ?? firstMeasure?.querySelector("metronome per-minute")?.textContent ?? "";
  const time = firstAttributes ? child(firstAttributes, "time") : null;
  const beats = child(time ?? document.createElement("div"), "beats")?.textContent ?? "4";
  const beatType = child(time ?? document.createElement("div"), "beat-type")?.textContent ?? "4";
  const key = keyTonic(firstAttributes ?? document.createElement("div"));
  const title = doc.querySelector("movement-title")?.textContent?.trim() || doc.querySelector("work-title")?.textContent?.trim() || "";
  return { doc, parts, names, ...key, beats, beatType, tempo, title };
}

function makeMeasures(parts, warnings, names, initialState) {
  const measures = [];
  const state = { ...initialState };
  let divisions = 1;
  const count = Math.max(...parts.map((part) => children(part, "measure").length), 0);
  for (let i = 0; i < count; i += 1) {
    const firstPartMeasure = children(parts[0], "measure")[i];
    const durationGuess = Math.max(1, number(child(firstPartMeasure, "duration"), 4));
    state.measureDuration = durationGuess;
    const { changes, annotations } = readMeasureChanges(firstPartMeasure, state);
    const lines = parts.map((part) => {
      const measure = children(part, "measure")[i];
      if (!measure) return { events: [], duration: 0 };
      const attrs = children(measure, "attributes").at(0);
      divisions = number(child(attrs ?? document.createElement("div"), "divisions"), divisions) || divisions;
      const result = parseMeasure(measure, divisions, warnings, names.get(part.getAttribute("id")) || part.getAttribute("id"), state.tonic, state.minor);
      divisions = result.divisions;
      return result;
    });
    const duration = Math.max(...lines.map((line) => line.duration), 1);
    annotations.forEach((annotation) => { annotation.ratio = Math.max(0, Math.min(1, annotation.ratio * durationGuess / duration)); });
    measures.push({ number: firstPartMeasure?.getAttribute("number") || String(i + 1), lines, duration, changes, annotations, state: { ...state } });
  }
  return measures;
}

function prepareMeasureLayout(measure, lyricFontSize) {
  const events = measure.lines.flatMap((line) => line.events);
  const onsets = [...new Set(events.map((event) => event.x))].sort((a, b) => a - b);
  const widths = onsets.map((onset, index) => {
    const group = events.filter((event) => event.x === onset);
    const lyricWidth = Math.max(0, ...group.map((event) => Array.from(event.lyric).length * lyricFontSize * 0.58 + 12));
    const sustainWidth = Math.max(0, ...group.map((event) => Math.max(0, Math.floor(event.duration + 0.001) - 1) * 12 + 42));
    const next = onsets[index + 1] ?? measure.duration;
    const rhythmicWidth = Math.max(0, next - onset) * 15;
    return Math.max(46, lyricWidth, sustainWidth, rhythmicWidth);
  });
  const starts = new Map();
  let cursor = 0;
  for (let i = 0; i < onsets.length; i += 1) {
    starts.set(onsets[i], { x: cursor, width: widths[i] });
    cursor += widths[i];
  }
  return { width: 116 + cursor, slotWidth: cursor, slots: starts };
}

function drawNote(svg, event, x, y, slotWidth, { fontFamily, lyricFontSize }) {
  const centerX = x + 4;
  if (event.rest) {
    text(svg, "0", { x: centerX, y, "text-anchor": "middle", class: "jianpu-note", "font-family": fontFamily });
  } else if (event.pitch) {
    text(svg, event.pitch.label, { x: centerX, y, "text-anchor": "middle", class: "jianpu-note", "font-family": fontFamily });
    const dots = Math.abs(event.pitch.octaveShift);
    for (let i = 0; i < dots; i += 1) {
      const dotY = event.pitch.octaveShift > 0 ? y - 24 - i * 5 : y + 8 + i * 5;
      el("circle", { cx: centerX, cy: dotY, r: 1.7, class: "jianpu-octave-dot" }, svg);
    }
  }
  const sustainCount = Math.max(0, Math.floor(event.duration + 0.001) - 1);
  for (let i = 0; i < sustainCount; i += 1) {
    text(svg, "-", { x: centerX + 15 + i * 12, y, "text-anchor": "middle", class: "jianpu-sustain" });
  }
  const beamCount = rhythmLines(event.type);
  const lowOctaveDots = event.pitch?.octaveShift < 0 ? Math.abs(event.pitch.octaveShift) : 0;
  for (let i = 0; i < beamCount; i += 1) {
    const rhythmY = y + 15 + lowOctaveDots * 8 + i * 5;
    el("line", { x1: centerX - 6, x2: centerX + 6, y1: rhythmY, y2: rhythmY, class: "jianpu-rhythm" }, svg);
  }
  const fraction = event.duration - Math.floor(event.duration + 0.001);
  const dotCount = event.duration < 1 ? event.dots : Math.abs(fraction - 0.75) < 0.001 ? 2 : Math.abs(fraction - 0.5) < 0.001 ? 1 : 0;
  for (let i = 0; i < dotCount; i += 1) el("circle", { cx: centerX + 12 + sustainCount * 12 + i * 5, cy: y - 9, r: 1.7, class: "jianpu-dot" }, svg);
  if (event.lyric) {
    const lyric = text(svg, event.lyric, { x: centerX, y: y + Math.max(40, lyricFontSize + 22), "text-anchor": "middle", class: "jianpu-lyric", "font-family": fontFamily, "font-size": lyricFontSize });
    const estimatedWidth = Array.from(event.lyric).reduce((width, char) => width + (char.codePointAt(0) > 255 ? lyricFontSize : lyricFontSize * 0.58), 0);
    if (estimatedWidth > slotWidth - 8) {
      lyric.setAttribute("textLength", String(Math.max(10, slotWidth - 8)));
      lyric.setAttribute("lengthAdjust", "spacingAndGlyphs");
    }
  }
}

function packSystems(measures, pageWidth, margin, lyricFontSize) {
  const available = pageWidth - margin * 2;
  const systems = [];
  let current = { measures: [], width: 0 };
  for (const measure of measures) {
    const layout = prepareMeasureLayout(measure, lyricFontSize);
    const width = Math.min(layout.width, available);
    if (current.measures.length && current.width + width > available) {
      systems.push(current);
      current = { measures: [], width: 0 };
    }
    const scale = layout.slotWidth ? Math.min(1, Math.max(0, (width - 116) / layout.slotWidth)) : 1;
    current.measures.push({ measure, layout, width, scale });
    current.width += width;
  }
  if (current.measures.length) systems.push(current);
  return systems;
}

function drawTie(svg, x1, x2, y, octaveShift = 0) {
  if (x2 <= x1 + 2) return;
  const rise = Math.min(18, Math.max(8, (x2 - x1) * 0.08));
  const offsetY = y - 17 - Math.max(0, octaveShift) * 6;
  el("path", { d: `M ${x1} ${offsetY} Q ${(x1 + x2) / 2} ${offsetY - rise} ${x2} ${offsetY}`, class: "jianpu-tie" }, svg);
}

export async function renderJianpu(xml, container, {
  width = 900,
  height = 1100,
  fontFamily = "serif",
  lyricFontSize = 14,
  showMeasureNumbers = true,
  showPageNumbers = true,
  drawTitle = true,
} = {}) {
  if (typeof xml !== "string") throw new TypeError("MusicXML must be a string.");
  if (!container?.append) throw new TypeError("A DOM container is required.");
  const warnings = [];
  const { parts, names, tonic, minor, beats, beatType, tempo, title } = getSongData(xml);
  const initialState = { tonic, minor, beats, beatType, tempo };
  const measures = makeMeasures(parts, warnings, names, initialState);
  const margin = 24;
  const pageWidth = Math.max(320, Number(width) || 900);
  const safeLyricFontSize = Math.max(8, Math.min(28, Number(lyricFontSize) || 14));
  const systems = packSystems(measures, pageWidth, margin, safeLyricFontSize);
  const hasAnnotations = measures.some((measure) => measure.annotations.length);
  const annotationBand = hasAnnotations ? 30 : 0;
  const voiceOffset = hasAnnotations ? 78 : 49;
  const partSpacing = Math.max(68, safeLyricFontSize + 54);
  const rowHeight = 56 + annotationBand + parts.length * partSpacing;
  const showTitle = drawTitle && Boolean(title);
  const headerHeight = showTitle ? 86 : 66;
  const maxPageHeight = Math.max(400, Number(height) || 1100);
  const systemsPerPage = Math.max(1, Math.floor((maxPageHeight - headerHeight - margin) / rowHeight));
  const pageCount = Math.max(1, Math.ceil(systems.length / systemsPerPage));
  const svgs = [];
  const eventPositions = new Map();
  const styleText = `.jianpu-note{font-size:24px;fill:#111}.jianpu-lyric{font-size:${safeLyricFontSize}px;fill:#333}.jianpu-rhythm,.jianpu-tie{stroke:#111;stroke-width:1.5;fill:none}.jianpu-sustain{font-size:20px;fill:#111}.jianpu-dot,.jianpu-octave-dot{fill:#111}.jianpu-bar{stroke:#888;stroke-width:1}.jianpu-label{font-size:14px;fill:#222}.jianpu-system-change{font-size:12px;fill:#444}.jianpu-annotation{fill:#4b5563}.jianpu-measure{font-size:12px;fill:#777}.jianpu-page{display:block;max-width:100%;height:auto;margin:0 auto 18px}@media print{@page{size:A4 portrait;margin:10mm}.jianpu-page{width:190mm;height:auto;max-width:none;margin:0;break-after:page;page-break-after:always}.jianpu-page:last-of-type{break-after:auto;page-break-after:auto}}`;
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const pageSystems = systems.slice(pageIndex * systemsPerPage, (pageIndex + 1) * systemsPerPage);
    const pageHeight = maxPageHeight;
    const svg = el("svg", { xmlns: SVG_NS, viewBox: `0 0 ${pageWidth} ${pageHeight}`, width: "100%", height: pageHeight, "font-family": fontFamily, role: "img", "aria-label": `${title ? `${title} ` : ""}Chinese numbered notation, page ${pageIndex + 1} of ${pageCount}`, class: "jianpu-page" });
    const style = el("style", {}, svg);
    style.textContent = styleText;
    if (showTitle) text(svg, title, { x: margin, y: 25, class: "jianpu-label", "font-family": fontFamily });
    const firstState = measures[0]?.state ?? initialState;
    text(svg, `1=${firstState.tonic}　${firstState.beats}/${firstState.beatType}${firstState.tempo ? `　♩=${firstState.tempo}` : ""}`, { x: margin, y: title ? 50 : 28, class: "jianpu-label" });
    if (showPageNumbers) text(svg, `${pageIndex + 1}/${pageCount}`, { x: pageWidth - margin, y: showTitle ? 50 : 28, "text-anchor": "end", class: "jianpu-measure" });
    pageSystems.forEach((system, pageRow) => {
      system.svg = svg;
      system.pageIndex = pageIndex;
      system.pageRow = pageRow;
      system.top = headerHeight + pageRow * rowHeight;
      const yTop = system.top;
      const yBottom = yTop + rowHeight - 4;
      for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
        const name = names.get(parts[partIndex].getAttribute("id")) || `声部${partIndex + 1}`;
        text(svg, name, { x: margin + 4, y: yTop + voiceOffset + partIndex * partSpacing, class: "jianpu-label", "font-family": fontFamily });
      }
      for (const measureEntry of system.measures) {
        const { measure, layout, width: widthHere, scale } = measureEntry;
        const x0 = margin + system.measures.slice(0, system.measures.indexOf(measureEntry)).reduce((sum, entry) => sum + entry.width, 0);
        if (showMeasureNumbers) text(svg, measure.number, { x: x0 + 2, y: yTop + 15, class: "jianpu-measure" });
        if (measure.changes.length) text(svg, measure.changes.join("　"), { x: x0 + 26, y: yTop + 15, class: "jianpu-system-change" });
        for (const annotation of measure.annotations) {
          const annotationX = x0 + 100 + layout.slotWidth * annotation.ratio * scale;
          text(svg, annotation.text, { x: Math.min(x0 + widthHere - 4, annotationX), y: yTop + 40, "text-anchor": annotationX > x0 + widthHere - 20 ? "end" : "start", class: "jianpu-annotation", "font-size": annotation.fontSize });
        }
        el("line", { x1: x0 + widthHere, x2: x0 + widthHere, y1: yTop + 22, y2: yBottom, class: "jianpu-bar" }, svg);
        for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
          const line = measure.lines[partIndex];
          const y = yTop + voiceOffset + partIndex * partSpacing;
          for (const event of line.events) {
            const slot = layout.slots.get(event.x) ?? { x: 0, width: 44 };
            const x = x0 + 100 + (slot.x + slot.width / 2) * scale - 4;
            const slotWidth = slot.width * scale;
            drawNote(svg, event, x, y, slotWidth, { fontFamily, lyricFontSize: safeLyricFontSize });
            eventPositions.set(event, { x: x + 4, y, system, partIndex });
          }
        }
      }
    });
    svgs.push(svg);
  }

  const allSystemRows = systems;
  for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
    const activeTies = new Map();
    for (const measure of measures) {
      for (const event of measure.lines[partIndex]?.events ?? []) {
        if (!event.pitch) continue;
        const key = event.pitch.midi;
        const position = eventPositions.get(event);
        if (event.ties.includes("stop")) {
          const start = activeTies.get(key);
          if (start && position) {
            const fromSystem = allSystemRows.indexOf(start.system);
            const toSystem = allSystemRows.indexOf(position.system);
            if (fromSystem === toSystem) {
              drawTie(position.system.svg, start.x + 8, position.x - 8, position.y, event.pitch.octaveShift);
            } else {
              for (let systemIndex = fromSystem; systemIndex <= toSystem; systemIndex += 1) {
                const system = allSystemRows[systemIndex];
                const y = system.top + voiceOffset + partIndex * partSpacing;
                const left = margin + 100;
                const right = pageWidth - margin - 8;
                const x1 = systemIndex === fromSystem ? start.x + 8 : left;
                const x2 = systemIndex === toSystem ? position.x - 8 : right;
                drawTie(system.svg, x1, x2, y, event.pitch.octaveShift);
              }
            }
          }
          activeTies.delete(key);
        }
        if (event.ties.includes("start") && position) activeTies.set(key, position);
      }
    }
  }

  container.replaceChildren(...svgs);
  return { warnings, svg: svgs[0] ?? null, svgs };
}

export { parsePitch, rhythmLines };
