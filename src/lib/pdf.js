export const PAPER_SIZES = Object.freeze({
  a4: Object.freeze({ width: 210, height: 297 }),
  letter: Object.freeze({ width: 215.9, height: 279.4 }),
  legal: Object.freeze({ width: 215.9, height: 355.6 }),
  a3: Object.freeze({ width: 297, height: 420 }),
  a5: Object.freeze({ width: 148, height: 210 }),
});

const RASTER_DPI = 220;
const PAGE_MARGIN_MM = 10;
const INLINE_STYLE_PROPERTIES = [
  'font-family', 'font-size', 'font-weight', 'font-style', 'fill', 'fill-opacity',
  'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin',
  'text-anchor', 'dominant-baseline', 'letter-spacing', 'opacity', 'display',
  'shape-rendering', 'paint-order',
];

export function getPaperDimensions(paperSize = 'a4', orientation = 'portrait') {
  const key = String(paperSize).toLowerCase();
  const size = PAPER_SIZES[key];
  if (!size) throw new RangeError(`Unsupported paper size: ${paperSize}`);
  if (orientation !== 'portrait' && orientation !== 'landscape') {
    throw new RangeError(`Unsupported page orientation: ${orientation}`);
  }
  return orientation === 'landscape'
    ? { width: size.height, height: size.width }
    : { width: size.width, height: size.height };
}

function viewBoxFor(svg) {
  const { x, y, width, height } = svg.viewBox.baseVal;
  if (width > 0 && height > 0) return { x, y, width, height };
  const widthAttribute = Number.parseFloat(svg.getAttribute('width'));
  const heightAttribute = Number.parseFloat(svg.getAttribute('height'));
  if (widthAttribute > 0 && heightAttribute > 0) return { x: 0, y: 0, width: widthAttribute, height: heightAttribute };
  throw new TypeError('Each SVG page must have a non-empty viewBox or explicit dimensions.');
}

function copySvgStyles(source, clone) {
  const sourceNodes = [source, ...source.querySelectorAll('*')];
  const cloneNodes = [clone, ...clone.querySelectorAll('*')];
  sourceNodes.forEach((sourceNode, index) => {
    const target = cloneNodes[index];
    if (!target || sourceNode.localName === 'style') return;
    target.style.removeProperty('visibility');
    target.removeAttribute('visibility');
    const computed = globalThis.getComputedStyle?.(sourceNode);
    if (!computed) return;
    for (const property of INLINE_STYLE_PROPERTIES) {
      const value = computed.getPropertyValue(property);
      if (value) target.style.setProperty(property, value);
    }
  });
  clone.style.setProperty('visibility', 'visible');
  clone.style.removeProperty('display');
}

function loadSvgImage(svg, title) {
  const bounds = viewBoxFor(svg);
  const clone = svg.cloneNode(true);
  copySvgStyles(svg, clone);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`);
  clone.setAttribute('width', String(bounds.width));
  clone.setAttribute('height', String(bounds.height));
  if (title && !clone.querySelector('title')) {
    const titleNode = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    titleNode.textContent = title;
    clone.insertBefore(titleNode, clone.firstChild);
  }
  const source = new XMLSerializer().serializeToString(clone);
  const objectUrl = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
  const image = new Image();
  const promise = new Promise((resolve, reject) => {
    image.onload = () => resolve({ image, objectUrl, bounds });
    image.onerror = () => reject(new Error('Unable to rasterize an SVG score page.'));
  });
  image.src = objectUrl;
  return promise.catch((error) => {
    URL.revokeObjectURL(objectUrl);
    throw error;
  });
}

export async function createPdf(svgPages, {
  paperSize = 'a4',
  orientation = 'portrait',
  title = '',
} = {}) {
  const pages = Array.from(svgPages ?? []);
  if (!pages.length) throw new TypeError('At least one SVG score page is required.');
  if (pages.some((page) => page?.localName !== 'svg')) throw new TypeError('Every score page must be an SVG element.');
  if (document.fonts?.ready) await document.fonts.ready;
  const {jsPDF}=await import('jspdf');

  const dimensions = getPaperDimensions(paperSize, orientation);
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [dimensions.width, dimensions.height],
    compress: true,
  });
  if (title) pdf.setProperties({ title: String(title) });
  const printableWidth = dimensions.width - PAGE_MARGIN_MM * 2;
  const printableHeight = dimensions.height - PAGE_MARGIN_MM * 2;
  const canvasWidth = Math.ceil(printableWidth * RASTER_DPI / 25.4);
  const canvasHeight = Math.ceil(printableHeight * RASTER_DPI / 25.4);

  for (let index = 0; index < pages.length; index += 1) {
    if (index > 0) pdf.addPage([dimensions.width, dimensions.height], orientation);
    const { image, objectUrl, bounds } = await loadSvgImage(pages[index], title);
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    try {
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Canvas rendering is unavailable.');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvasWidth, canvasHeight);
      const scale = Math.min(canvasWidth / bounds.width, canvasHeight / bounds.height);
      const drawWidth = bounds.width * scale;
      const drawHeight = bounds.height * scale;
      context.drawImage(image, (canvasWidth - drawWidth) / 2, 0, drawWidth, drawHeight);
      pdf.addImage(canvas, 'PNG', PAGE_MARGIN_MM, PAGE_MARGIN_MM, printableWidth, printableHeight, undefined, 'FAST');
    } finally {
      URL.revokeObjectURL(objectUrl);
      image.removeAttribute('src');
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  return new Uint8Array(pdf.output('arraybuffer'));
}
