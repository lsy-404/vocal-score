export const PAPER_SIZES = Object.freeze({
  a4: Object.freeze({ width: 210, height: 297 }),
  letter: Object.freeze({ width: 215.9, height: 279.4 }),
  legal: Object.freeze({ width: 215.9, height: 355.6 }),
  a3: Object.freeze({ width: 297, height: 420 }),
  a5: Object.freeze({ width: 148, height: 210 }),
});

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

/** Loads the PDF worker and its jsPDF module once, so the first download does not wait for them; false without workers. */
export function warmPdfWorker() {
  if (typeof Worker !== 'function') return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./pdf.worker.js', import.meta.url), {type: 'module'});
    worker.onmessage = () => { worker.terminate(); resolve(true); };
    worker.onerror = event => { worker.terminate(); reject(new Error(event.message || 'Unable to start the PDF worker.')); };
    worker.postMessage({type: 'ping'});
  });
}

export async function createPdf(svgPages, {
  paperSize = 'a4',
  orientation = 'portrait',
  title = '',
  dpi = 220,
  margin = PAGE_MARGIN_MM,
  signal,
} = {}) {
  const pages = Array.from(svgPages ?? []);
  if (!pages.length) throw new TypeError('At least one SVG score page is required.');
  if (pages.some((page) => page?.localName !== 'svg')) throw new TypeError('Every score page must be an SVG element.');
  signal?.throwIfAborted();
  if (document.fonts?.ready) await document.fonts.ready;
  const dimensions = getPaperDimensions(paperSize, orientation);
  if(!Number.isFinite(dpi)||dpi<72||dpi>300)throw new RangeError('PDF raster resolution must be between 72 and 300 DPI.');
  const worker=new Worker(new URL('./pdf.worker.js',import.meta.url),{type:'module'});
  let rejectResult;
  const result=new Promise((resolve,reject)=>{
    rejectResult=reject;
    worker.onmessage=({data})=>data.error?reject(new Error(data.error)):resolve(new Uint8Array(data.bytes));
    worker.onerror=event=>reject(new Error(event.message||'Unable to generate PDF.'));
  });
  result.catch(()=>{});
  const abort=()=>{worker.terminate();rejectResult(signal.reason);};
  signal?.addEventListener('abort',abort,{once:true});
  worker.postMessage({type:'start',dimensions,orientation,title});
  if (!Number.isFinite(margin) || margin < 0 || margin * 2 >= Math.min(dimensions.width, dimensions.height)) throw new RangeError('Page margin must leave a printable area.');
  const printableWidth = dimensions.width - margin * 2;
  const printableHeight = dimensions.height - margin * 2;
  const canvasWidth = Math.ceil(printableWidth * dpi / 25.4);
  const canvasHeight = Math.ceil(printableHeight * dpi / 25.4);

  try{
  for (let index = 0; index < pages.length; index += 1) {
    signal?.throwIfAborted();
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
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Unable to encode a PDF page.')),'image/png'));
      const bytes=await blob.arrayBuffer();
      signal?.throwIfAborted();
      worker.postMessage({type:'page',index,bytes,margin},[bytes]);
    } finally {
      URL.revokeObjectURL(objectUrl);
      image.removeAttribute('src');
      canvas.width = 0;
      canvas.height = 0;
    }
  }
  worker.postMessage({type:'finish'});
  return await result;
  }finally{
    signal?.removeEventListener('abort',abort);worker.terminate();
  }
}
