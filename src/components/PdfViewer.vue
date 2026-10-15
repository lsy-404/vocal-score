<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { t } from '../i18n.js';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const props = defineProps({
  bytes: { type: Uint8Array, default: null },
  textTargets: { type: Array, default: () => [] },
});
const emit = defineEmits(['ready', 'error']);
const viewportElement = ref(null);
const pageElements = ref([]);
const pageSlots = shallowRef([]);
const pageNumber = ref(1);
const pageInput = ref(1);
const totalPages = ref(0);
const zoom = ref('width');
const layout = ref({ width: 1, height: 1 });
const loading = ref(false);
const failed = ref(false);

let loadingTask = null;
let pdfDocument = null;
let documentGeneration = 0;
let resizeObserver = null;
let resizeFrame = 0;
let scrollFrame = 0;
const PAGE_GAP = 10;
const nearbyPages = new Set();

const pageLabel = computed(() => t('第 {page} 页，共 {total} 页', { page: pageNumber.value, total: totalPages.value }));

function getSlot(number) {
  return pageSlots.value[number - 1];
}

function clearPageWindow() {
  nearbyPages.clear();
}

function clearSlotCanvas(slot) {
  const canvas = slot?.element?.querySelector('canvas')
    || viewportElement.value?.querySelector(`[data-page-number="${slot?.number}"] canvas`);
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
  canvas.style.removeProperty('width');
  canvas.style.removeProperty('height');
  delete canvas.dataset.rendered;
}

async function cancelSlot(slot, clear = true) {
  if (!slot) return;
  slot.generation += 1;
  slot.task?.cancel();
  const previous = slot.renderPromise;
  if (clear) clearSlotCanvas(slot);
  slot.renderedScale = null;
  try { await previous; } catch {}
  slot.task = null;
  if (slot.renderPromise === previous) slot.renderPromise = null;
  slot.requestedScale = null;
  if (nearbyPages.has(slot.number) && pdfDocument) renderSlot(slot);
}

async function releaseDocument() {
  clearPageWindow();
  await Promise.all(pageSlots.value.map((slot) => cancelSlot(slot)));
  pageSlots.value = [];
  pageElements.value = [];
  layout.value = { width: 1, height: 1 };
  totalPages.value = 0;
  const oldLoadingTask = loadingTask;
  const oldDocument = pdfDocument;
  loadingTask = null;
  pdfDocument = null;
  if (oldLoadingTask) {
    try { await oldLoadingTask.destroy(); } catch {}
  } else if (oldDocument) {
    try { await oldDocument.destroy(); } catch {}
  }
}

function calculateLayout() {
  if (!pdfDocument || !viewportElement.value || !pageSlots.value.length) return;
  const availableWidth = Math.max(1, viewportElement.value.clientWidth - 24);
  const availableHeight = Math.max(1, viewportElement.value.clientHeight - 24);
  const widthScale = availableWidth / pageSlots.value[0].baseWidth;
  const scale = zoom.value === 'width' ? widthScale : zoom.value === 'fit'
    ? Math.min(widthScale, availableHeight / pageSlots.value[0].baseHeight)
    : Number(zoom.value);
  layout.value = {
    width: pageSlots.value[0].baseWidth * scale,
    height: pageSlots.value[0].baseHeight * scale,
  };
}

function pageStyle() {
  return { width: `${layout.value.width}px`, height: `${layout.value.height}px` };
}

function targetsForPage(number) {
  return props.textTargets.filter((target) => target.pageIndex === number - 1);
}

async function renderSlot(slot) {
  const scale = layout.value.width / slot.baseWidth;
  if (slot.renderPromise && slot.requestedScale === scale) return;
  if (slot.renderedScale === scale && slot.element?.querySelector('canvas')?.dataset.rendered === 'true') return;
  const generation = ++slot.generation;
  slot.task?.cancel();
  const previous = slot.renderPromise;
  if (previous) {
    try { await previous; } catch {}
  }
  if (generation !== slot.generation || !nearbyPages.has(slot.number) || !pdfDocument) return;

  const target = slot.element;
  const canvas = target?.querySelector('canvas');
  if (!canvas) return;
  slot.requestedScale = scale;

  const documentProxy = pdfDocument;
  const promise = (async () => {
    const page = await documentProxy.getPage(slot.number);
    if (generation !== slot.generation || documentProxy !== pdfDocument || !nearbyPages.has(slot.number)) {
      page.cleanup();
      return;
    }
    const viewport = page.getViewport({ scale });
    const pixelRatio = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas rendering is unavailable.');
    canvas.width = Math.ceil(viewport.width * pixelRatio);
    canvas.height = Math.ceil(viewport.height * pixelRatio);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    canvas.dataset.rendered = 'false';
    const task = page.render({
      canvasContext: context,
      viewport,
      transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0],
    });
    slot.task = task;
    try {
      await task.promise;
      if (generation === slot.generation && documentProxy === pdfDocument) {
        canvas.dataset.rendered = 'true';
        slot.renderedScale = scale;
      }
    } finally {
      if (slot.task === task) slot.task = null;
      page.cleanup();
    }
  })();
  slot.renderPromise = promise;
  try {
    await promise;
  } catch (error) {
    if (generation === slot.generation && error?.name !== 'RenderingCancelledException') {
      failed.value = true;
      emit('error', error);
    }
  } finally {
    if (slot.renderPromise === promise) slot.renderPromise = null;
  }
}

function setCurrentPage(number) {
  if (number < 1 || number > totalPages.value || number === pageNumber.value) return;
  pageNumber.value = number;
  if (document.activeElement !== document.querySelector('.pdf-viewer__page-input')) pageInput.value = number;
}

function updatePageWindow() {
  const viewport = viewportElement.value;
  const firstPage = pageElements.value[0];
  if (!viewport || !firstPage || !pdfDocument || !pageSlots.value.length) return;
  const rootTop = viewport.getBoundingClientRect().top;
  const firstTop = firstPage.getBoundingClientRect().top - rootTop + viewport.scrollTop;
  const pageStep = layout.value.height + PAGE_GAP;
  const margin = Math.max(viewport.clientHeight, 500);
  const firstVisible = Math.max(0, Math.floor((viewport.scrollTop - margin - firstTop) / pageStep));
  const lastVisible = Math.min(pageSlots.value.length - 1, Math.ceil((viewport.scrollTop + viewport.clientHeight + margin - firstTop) / pageStep));
  const nextNearby = new Set();
  for (let index = firstVisible; index <= lastVisible; index += 1) nextNearby.add(index + 1);
  for (const number of nearbyPages) {
    if (!nextNearby.has(number)) {
      nearbyPages.delete(number);
      const slot = getSlot(number);
      cancelSlot(slot);
      clearSlotCanvas(slot);
    }
  }
  for (const number of nextNearby) {
    nearbyPages.add(number);
    renderSlot(getSlot(number));
  }

  const center = viewport.scrollTop + viewport.clientHeight / 2;
  const currentIndex = Math.round((center - firstTop) / pageStep);
  setCurrentPage(Math.min(pageSlots.value.length, Math.max(1, currentIndex + 1)));
}

async function loadPdf(bytes) {
  const generation = ++documentGeneration;
  loading.value = bytes instanceof Uint8Array && bytes.byteLength > 0;
  failed.value = false;
  await releaseDocument();
  if (generation !== documentGeneration) return;
  pageNumber.value = 1;
  pageInput.value = 1;
  if (!(bytes instanceof Uint8Array) || !bytes.byteLength) {
    loading.value = false;
    return;
  }

  try {
    const task = getDocument({ data: new Uint8Array(bytes) });
    loadingTask = task;
    const documentProxy = await task.promise;
    if (generation !== documentGeneration) {
      await task.destroy();
      return;
    }
    pdfDocument = documentProxy;
    const firstPage = await documentProxy.getPage(1);
    const firstViewport = firstPage.getViewport({ scale: 1 });
    firstPage.cleanup();
    pageSlots.value = Array.from({ length: documentProxy.numPages }, (_, index) => ({
      number: index + 1,
      baseWidth: firstViewport.width,
      baseHeight: firstViewport.height,
      element: null,
      task: null,
      renderPromise: null,
      generation: 0,
      renderedScale: null,
    }));
    totalPages.value = documentProxy.numPages;
    calculateLayout();
    loading.value = false;
    await nextTick();
    if (generation !== documentGeneration || documentProxy !== pdfDocument) return;
    updatePageWindow();
    emit('ready', { pages: documentProxy.numPages });
  } catch (error) {
    if (generation === documentGeneration) {
      loading.value = false;
      failed.value = true;
      emit('error', error);
    }
  }
}

function bindPageElement(element, slot) {
  if (element) {
    slot.element = element;
    element.dataset.pageNumber = String(slot.number);
    pageElements.value[slot.number - 1] = element;
  } else {
    slot.element = null;
    pageElements.value[slot.number - 1] = null;
  }
}

function navigateToPage() {
  const requested = Math.min(totalPages.value, Math.max(1, Math.trunc(Number(pageInput.value) || 1)));
  pageInput.value = requested;
  setCurrentPage(requested);
  pageElements.value[requested - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function previousPage() {
  pageInput.value = Math.max(1, pageNumber.value - 1);
  navigateToPage();
}

function nextPage() {
  pageInput.value = Math.min(totalPages.value, pageNumber.value + 1);
  navigateToPage();
}

function onResize() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(async () => {
    calculateLayout();
    await nextTick();
    updatePageWindow();
  });
}

function onScroll() {
  cancelAnimationFrame(scrollFrame);
  scrollFrame = requestAnimationFrame(updatePageWindow);
}

watch(() => props.bytes, loadPdf, { immediate: true, flush: 'post' });
watch(zoom, onResize);

onMounted(() => {
  viewportElement.value?.addEventListener('scroll', onScroll, { passive: true });
  resizeObserver = new ResizeObserver(onResize);
  if (viewportElement.value) resizeObserver.observe(viewportElement.value);
});

onBeforeUnmount(async () => {
  documentGeneration += 1;
  cancelAnimationFrame(resizeFrame);
  cancelAnimationFrame(scrollFrame);
  viewportElement.value?.removeEventListener('scroll', onScroll);
  resizeObserver?.disconnect();
  await releaseDocument();
});
</script>

<template>
  <section class="pdf-viewer" :aria-label="t('PDF 预览')">
    <header class="pdf-viewer__toolbar">
      <div class="pdf-viewer__navigation">
        <button class="fluent-button" type="button" :disabled="pageNumber <= 1 || loading" :aria-label="t('上一页')" @click="previousPage">‹</button>
        <label class="pdf-viewer__page-control">
          <span class="pdf-viewer__page-count" aria-live="polite">{{ pageLabel }}</span>
          <input v-model.number="pageInput" class="fluent-field__input pdf-viewer__page-input" type="number" min="1" :max="totalPages || 1" :disabled="loading || !totalPages" :aria-label="t('页码')" @change="navigateToPage" @keydown.enter.prevent="navigateToPage">
        </label>
        <button class="fluent-button" type="button" :disabled="pageNumber >= totalPages || loading" :aria-label="t('下一页')" @click="nextPage">›</button>
      </div>
      <select v-model="zoom" class="fluent-select__control pdf-viewer__zoom" :aria-label="t('PDF 缩放')">
        <option value="width">{{ t('适合页宽') }}</option>
        <option value="fit">{{ t('适合页面') }}</option>
        <option value="0.75">75%</option>
        <option value="1">100%</option>
        <option value="1.25">125%</option>
      </select>
    </header>
    <div ref="viewportElement" class="pdf-viewer__viewport">
      <p v-if="loading" class="pdf-viewer__message">{{ t('正在加载 PDF…') }}</p>
      <p v-else-if="failed" class="pdf-viewer__message pdf-viewer__message--error">{{ t('PDF 渲染失败') }}</p>
      <div v-else-if="totalPages" class="pdf-viewer__pages">
        <article v-for="slot in pageSlots" :key="slot.number" :ref="element => bindPageElement(element, slot)" class="pdf-viewer__page" :data-page-number="slot.number" :style="pageStyle()" :aria-label="t('第 {page} 页，共 {total} 页', { page: slot.number, total: totalPages })">
          <canvas class="pdf-viewer__canvas" />
          <div class="pdf-viewer__page-overlay">
            <slot name="page-overlay" :page-number="slot.number" :width="layout.width" :height="layout.height" :text-targets="targetsForPage(slot.number)" />
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pdf-viewer {
  display: flex;
  min-width: 0;
  height: min(82vh, 1000px);
  min-height: 460px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--fluent-border, #d7dbe0);
  border-radius: 8px;
  background: var(--fluent-surface, #fff);
  color: var(--fluent-text, #242424);
}

.pdf-viewer__toolbar {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--fluent-border, #d7dbe0);
}

.pdf-viewer__navigation {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.pdf-viewer__page-control {
  display: flex;
  align-items: center;
  gap: 7px;
}

.pdf-viewer__page-count {
  min-width: 9em;
  text-align: center;
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.pdf-viewer__page-input {
  width: 58px;
  padding-inline: 5px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.pdf-viewer__page-input::-webkit-inner-spin-button,
.pdf-viewer__page-input::-webkit-outer-spin-button {
  margin: 0;
}

.pdf-viewer__zoom {
  width: 150px;
  flex: 0 0 150px;
}

.pdf-viewer__viewport {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 12px;
  background: var(--fluent-bg, #f4f5f6);
  overscroll-behavior: contain;
}

.pdf-viewer__pages {
  display: flex;
  min-width: 100%;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.pdf-viewer__page {
  position: relative;
  flex: 0 0 auto;
  background: #fff;
  box-shadow: 0 2px 12px rgb(0 0 0 / 16%);
}

.pdf-viewer__canvas {
  display: block;
  max-width: none;
}

.pdf-viewer__page-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.pdf-viewer__page-overlay :deep(*) {
  pointer-events: auto;
}

.pdf-viewer__message {
  display: grid;
  min-height: 100%;
  margin: 0;
  place-items: center;
  color: var(--fluent-muted, #616161);
}

.pdf-viewer__message--error {
  color: var(--fluent-error, #b10e1c);
}

@media (max-width: 560px) {
  .pdf-viewer__toolbar {
    gap: 6px;
    padding-inline: 6px;
  }

  .pdf-viewer__navigation {
    gap: 4px;
  }

  .pdf-viewer__page-control {
    gap: 3px;
  }

  .pdf-viewer__page-count {
    min-width: 7em;
    font-size: 0.75rem;
  }

  .pdf-viewer__page-input {
    width: 46px;
  }

  .pdf-viewer__zoom {
    width: 110px;
    flex-basis: 110px;
    min-width: 0;
  }
}
</style>
