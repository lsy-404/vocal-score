// Recognises orchestral instruments from a track or channel name and/or a General MIDI program, so that
// instrumental sources (MIDI, FL Studio) can be laid out as a score: conventional order, family and clef.

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

// [score order, family, clef, name keywords, General MIDI programs]
const CATALOG = [
  [10, 'woodwind', 'treble', ['piccolo', '短笛', 'ピッコロ'], [72]],
  [11, 'woodwind', 'treble', ['flute', 'flauto', '长笛', 'フルート'], [73]],
  [12, 'woodwind', 'treble', ['recorder', '竖笛', 'リコーダー'], [74]],
  [13, 'woodwind', 'treble', ['pan flute', '排箫'], [75]],
  [14, 'woodwind', 'treble', ['oboe', '双簧管', 'オーボエ'], [68]],
  [15, 'woodwind', 'treble', ['english horn', 'cor anglais', '英国管', 'イングリッシュホルン'], [69]],
  [16, 'woodwind', 'treble', ['clarinet', 'klarinette', '单簧管', 'クラリネット'], [71]],
  [17, 'woodwind', 'bass', ['bassoon', 'fagott', 'contrabassoon', '大管', '巴松', 'ファゴット'], [70]],
  [18, 'woodwind', 'treble', ['saxophone', 'sax', '萨克斯', 'サックス'], range(64, 67)],
  [20, 'brass', 'treble', ['french horn', 'horn', 'corno', '圆号', 'ホルン'], [60]],
  [21, 'brass', 'treble', ['trumpet', 'tromba', 'cornet', '小号', 'トランペット'], [56, 59]],
  [22, 'brass', 'bass', ['trombone', '长号', 'トロンボーン'], [57]],
  [23, 'brass', 'bass', ['tuba', '大号', 'チューバ'], [58]],
  [24, 'brass', 'treble', ['brass', '铜管'], [61, 62, 63]],
  [30, 'percussion', 'bass', ['timpani', 'timp', '定音鼓', 'ティンパニ'], [47]],
  [31, 'percussion', 'treble', ['glockenspiel', 'glock', '钟琴', 'グロッケン'], [9]],
  [32, 'percussion', 'treble', ['xylophone', '木琴', 'シロフォン'], [13]],
  [33, 'percussion', 'treble', ['marimba', '马林巴', 'マリンバ'], [12]],
  [34, 'percussion', 'treble', ['vibraphone', '颤音琴', 'ビブラフォン'], [11]],
  [35, 'percussion', 'treble', ['tubular bell', 'chimes', '管钟', 'チャイム'], [14]],
  [36, 'percussion', 'percussion', ['drum', 'percussion', 'perc', 'cymbal', 'snare', 'kick', 'hihat', 'hi-hat', 'fpc', 'battery', '鼓', '镲', '打击乐', 'ドラム', 'パーカッション'], range(112, 119)],
  [40, 'keyboard', 'treble', ['harp', 'arpa', '竖琴', 'ハープ'], [46]],
  [41, 'keyboard', 'treble', ['celesta', 'celeste', '钢片琴', 'チェレスタ'], [8]],
  [42, 'keyboard', 'treble', ['piano', 'pno', '钢琴', 'ピアノ'], range(0, 7)],
  [43, 'keyboard', 'treble', ['organ', '风琴', 'オルガン'], range(16, 23)],
  [50, 'voice', 'treble', ['soprano', 'mezzo', 'tenor', 'baritone', 'choir', 'chorus', 'vocal', 'voice', '人声', '合唱', '女声', '男声', 'コーラス', 'ボーカル'], range(52, 54)],
  [60, 'strings', 'treble', ['violin', 'violino', 'vln', '小提琴', 'バイオリン', 'ヴァイオリン'], [40]],
  [61, 'strings', 'alto', ['viola', 'vla', '中提琴', 'ヴィオラ'], [41]],
  [62, 'strings', 'bass', ['violoncello', 'cello', 'vc', '大提琴', 'チェロ'], [42]],
  [63, 'strings', 'bass', ['contrabass', 'double bass', 'doublebass', 'kontrabass', 'cb', '低音提琴', 'コントラバス'], [43]],
  [64, 'strings', 'treble', ['string ensemble', 'strings', 'string', '弦乐', 'ストリングス'], [44, 45, 48, 49, 50, 51]],
  [70, 'other', 'treble', ['guitar', '吉他', 'ギター'], range(24, 31)],
  [71, 'other', 'bass', ['bass guitar', 'electric bass', 'synth bass', '贝斯', 'ベース'], range(32, 39)],
];

// Longest keywords first so that "english horn" wins over "horn" and "bassoon" over "bass".
const KEYWORDS = CATALOG.flatMap(entry => entry[3].map(keyword => [keyword.toLowerCase(), entry])).sort((a, b) => b[0].length - a[0].length);
const PROGRAMS = new Map(CATALOG.flatMap(entry => entry[4].map(program => [program, entry])));

function matchesName(name, keyword) {
  if (/[^\x00-\x7f]/u.test(keyword)) return name.includes(keyword);
  // Short Latin abbreviations must stand alone (so "vc" does not match inside another word).
  const pattern = keyword.length <= 4 ? new RegExp(`(^|[^a-z])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`, 'u') : null;
  return pattern ? pattern.test(name) : name.includes(keyword);
}

/**
 * @param {{ name?: string, program?: number, percussion?: boolean }} source
 * @returns {{ name: string, family: string, order: number, clef: string, percussion: boolean }}
 */
export function classifyInstrument({ name = '', program, percussion = false } = {}) {
  const label = String(name).trim();
  const lower = label.toLowerCase();
  const byName = KEYWORDS.find(([keyword]) => matchesName(lower, keyword))?.[1];
  const entry = percussion ? CATALOG.find(item => item[2] === 'percussion') : byName ?? PROGRAMS.get(Number(program));
  if (!entry) return { name: label, family: 'other', order: 80, clef: 'treble', percussion: false };
  const [order, family, clef] = entry;
  return { name: label, family, order, clef: clef === 'percussion' ? 'percussion' : clef, percussion: clef === 'percussion' };
}

export const INSTRUMENT_FAMILIES = ['woodwind', 'brass', 'percussion', 'keyboard', 'voice', 'strings', 'other'];
