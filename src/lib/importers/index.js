// Format registry. Metadata is static so the file picker and UI can list formats; each parser module (and the
// zip, zstd or YAML library it needs) loads only when a file of that format is opened.

export const FORMATS = [
  { id: 'svp', name: 'Synthesizer V Studio', short: 'SVP', extensions: ['svp'], load: () => import('./svp.js') },
  { id: 's5p', name: 'Synthesizer V', short: 'S5P', extensions: ['s5p'], beta: true, load: () => import('./s5p.js') },
  { id: 'acep', name: 'ACE Studio', short: 'ACEP', extensions: ['acep'], beta: true, load: () => import('./acep.js') },
  { id: 'vsqx', name: 'VOCALOID 3/4', short: 'VSQX', extensions: ['vsqx'], beta: true, load: () => import('./vsqx.js') },
  { id: 'vpr', name: 'VOCALOID 5/6', short: 'VPR', extensions: ['vpr'], beta: true, load: () => import('./vpr.js') },
  { id: 'vsq', name: 'VOCALOID 2', short: 'VSQ', extensions: ['vsq'], beta: true, load: () => import('./vsq.js') },
  { id: 'vocaloid-mid', name: 'VOCALOID MIDI', short: 'MID', extensions: ['mid', 'midi'], beta: true, load: () => import('./vocaloid-mid.js') },
  { id: 'midi', name: 'MIDI', short: 'MID', extensions: ['mid', 'midi'], beta: true, load: () => import('./midi.js') },
  { id: 'ust', name: 'UTAU', short: 'UST', extensions: ['ust'], beta: true, load: () => import('./ust.js') },
  { id: 'ustx', name: 'OpenUtau', short: 'USTX', extensions: ['ustx'], beta: true, load: () => import('./ustx.js') },
  { id: 'ccs', name: 'CeVIO', short: 'CCS', extensions: ['ccs'], beta: true, load: () => import('./ccs.js') },
  { id: 'tssln', name: 'VoiSona', short: 'TSSLN', extensions: ['tssln'], beta: true, load: () => import('./tssln.js') },
  { id: 'musicxml', name: 'MusicXML', short: 'MusicXML', extensions: ['musicxml', 'xml', 'mxl'], beta: true, load: () => import('./musicxml.js') },
  { id: 'dv', name: 'DeepVocal', short: 'DV', extensions: ['dv'], beta: true, load: () => import('./dv.js') },
  { id: 'ppsf', name: 'Piapro Studio NT', short: 'PPSF', extensions: ['ppsf'], beta: true, load: () => import('./ppsf.js') },
  { id: 'ufdata', name: 'UtaFormatix', short: 'UFDATA', extensions: ['ufdata'], beta: true, load: () => import('./ufdata.js') },
  { id: 'flp', name: 'FL Studio', short: 'FLP', extensions: ['flp'], beta: true, load: () => import('./flp.js') },
];

export const ACCEPT = [...new Set(FORMATS.flatMap(format => format.extensions.map(extension => `.${extension}`)))].join(',');

const extensionOf = fileName => (/\.([^./\\]+)$/u.exec(String(fileName))?.[1] ?? '').toLowerCase();

export function formatsFor(fileName) {
  return FORMATS.filter(format => format.extensions.includes(extensionOf(fileName)));
}

/** Parses a project file of any supported format; throws for unsupported extensions. */
export async function importProject(bytes, fileName) {
  const candidates = formatsFor(fileName);
  if (!candidates.length) throw new Error(`Unsupported file type: ${fileName}`);
  const modules = await Promise.all(candidates.map(async format => ({ format, importer: (await format.load()).default })));
  const chosen = modules.length === 1 ? modules[0] : modules.find(({ importer }) => importer.detect?.(bytes, fileName)) ?? modules.find(({ importer }) => !importer.detect) ?? modules.at(-1);
  const project = chosen.importer.parse(bytes, fileName);
  return { ...project, format: project.format || chosen.format.name, formatId: chosen.format.id, beta: Boolean(chosen.format.beta) };
}
