import {t} from './i18n.js';

const warningPatterns = [
  [/^Track (.+?): group (.+) was not found\.$/u, 'svp.warning.missingGroup', match => ({track: match[1], group: match[2]})],
  [/^Track (.+?): skipped a note with invalid timing or pitch\.$/u, 'svp.warning.invalidNote', match => ({track: match[1]})],
  [/^Track (.+?): ignored a non-finite note detune\.$/u, 'svp.warning.invalidDetune', match => ({track: match[1]})],
  [/^Track (.+?): pitch curves are not represented in MusicXML\.$/u, 'svp.warning.pitchControls', match => ({track: match[1]})],
  [/^(.+): (?:.+ )?pitch curve uses a linear sampling approximation for note adjustment\.$/u, 'svp.warning.linearCurve', match => ({track: match[1]})],
  [/^(.+): pitch curve shape is reduced to one representative value per note for score display\.$/u, 'svp.warning.representativeCurve', match => ({track: match[1]})],
  [/^(.+): remaining (-?\d+(?:\.\d+)?) cent tuning deviation is preserved as metadata, not engraved\.$/u, 'svp.warning.residual', match => ({track: match[1], cents: match[2]})],
  [/^(.+): (\d+) note\(s\) shifted by grid quantization\.$/u, 'svp.warning.quantized', match => ({track: match[1], count: match[2]})],
  [/^(.+): overlapping notes are rendered as (\d+) voices\.$/u, 'svp.warning.overlap', match => ({track: match[1], count: match[2]})],
  [/^(.+): pitch (-?\d+(?:\.\d+)?) is outside the supported MIDI range 0–127 or uses fractional semitones\.$/u, 'svp.warning.midiRange', match => ({track: match[1], pitch: match[2]})],
  [/^(.+): MusicXML backup timing indicates multiple voices in one part, which numbered-score rendering does not support\.$/u, 'svp.warning.multivoiceJianpu', match => ({track: match[1]})]
];

const errorPatterns = [
  [/^Expected a valid MusicXML partwise document\.$/u, 'svp.error.invalidXml'],
  [/^MusicXML must contain at least one part\.$/u, 'svp.error.noParts'],
  [/^Grid must be 4, 8, 16, or 32\.$/u, 'svp.error.grid'],
  [/^Pitch adjustment requires an enabled flag and threshold between 0 and 1200 cents\.$/u, 'svp.error.pitchAdjustment'],
  [/^Invalid transposition or key signature\.$/u, 'svp.error.transpose'],
  [/^Select at least one vocal track\.$/u, 'svp.error.noTrack'],
  [/^Selected tracks contain no vocal notes\.$/u, 'svp.error.noNotes'],
  [/^Cannot represent duration (.+) at the selected grid\.?$/u, 'svp.error.unsupportedDuration', match => ({duration: match[1]})],
  [/^Cannot represent rest duration (.+) at the selected grid\.?$/u, 'svp.error.unsupportedRest', match => ({duration: match[1]})],
  [/^Unsupported time signature length\.$/u, 'svp.error.timeSignature'],
  [/^Score exceeds the supported measure limit\.$/u, 'svp.error.measureLimit'],
  [/^Unsupported file type: (.+)$/u, 'import.error.unsupported', match => ({name: match[1]})],
  [/^Invalid (.+?) (?:project|file)(?:: (.+))?$/u, 'import.error.invalid', match => ({format: match[1], detail: match[2] ?? ''})]
];

function messageOf(value) {
  return value instanceof Error ? value.message : String(value ?? '');
}

function translate(value, patterns) {
  const text = messageOf(value);
  for (const [pattern, key, params] of patterns) {
    const match = pattern.exec(text);
    if (match) return t(key, params ? params(match) : {});
  }
  return text;
}

export function translateWarning(warning) {
  return translate(warning, warningPatterns);
}

export function translateError(cause) {
  const translated = translate(cause, [...warningPatterns, ...errorPatterns]);
  return translated;
}
