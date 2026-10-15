<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { t } from '../i18n.js';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const props = defineProps({ bytes: { type: Uint8Array, default: null } });
const emit = defineEmits(['ready', 'error']);
const canvasElement = ref(null);
const viewportElement = ref(null);
const pageNumber = ref(1);
const totalPages = ref(0);
const zoom = ref('width');
const loading = ref(false);
const failed = ref(false);

let loadingTask = null;
let pdfDocument = null;
let renderTask = null;
let renderGeneration = 0;
let documentGeneration = 0;
let renderQueue = Promise.resolve();
let resizeObserver = null;

const pageLabel = computed(() => t('第 {page} 页，共 {total} 页', { page: pageNumber.value, total: totalPages.value }));

async function releaseDocument() {
  renderGeneration += 1;
  renderTask?.cancel();
  await renderQueue.catch(() => {});
  renderTask = null;
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

async function renderPage(generation) {
  const documentProxy = pdfDocument;
  const canvas = canvasElement.value;
  const viewportElementValue = viewportElement.value;
  if (generation !== renderGeneration || !documentProxy || !canvas || !viewportElementValue) return;
  const page = await documentProxy.getPage(pageNumber.value);
  if (generation !== renderGeneration || documentProxy !== pdfDocument) return;

  const baseViewport = page.getViewport({ scale: 1 });
  const availableWidth = Math.max(1, viewportElementValue.clientWidth - 32);
  const availableHeight = Math.max(1, viewportElementValue.clientHeight - 32);
  const scale = zoom.value === 'width' ? availableWidth / baseViewport.width : zoom.value === 'fit'
    ? Math.min(availableWidth / baseViewport.width, availableHeight / baseViewport.height) : Number(zoom.value);
  const viewport = page.getViewport({ scale });
  const pixelRatio = Math.max(1, globalThis.devicePixelRatio || 1);
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas rendering is unavailable.');
  canvas.width = Math.ceil(viewport.width * pixelRatio);
  canvas.height = Math.ceil(viewport.height * pixelRatio);
  canvas.dataset.rendered='false';
  canvas.style.width = `${Math.ceil(viewport.width)}px`;
  canvas.style.height = `${Math.ceil(viewport.height)}px`;
  const task = page.render({
    canvasContext: context,
    viewport,
    transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0],
  });
  renderTask = task;
  try {
    await task.promise;
    if(generation===renderGeneration)canvas.dataset.rendered='true';
  } catch (error) {
    if (generation === renderGeneration && error?.name !== 'RenderingCancelledException') {
      failed.value = true;
      emit('error', error);
    }
  } finally {
    if (renderTask === task) renderTask = null;
    page.cleanup();
  }
}

function scheduleRender() {
  if (!pdfDocument) return;
  const generation = ++renderGeneration;
  renderTask?.cancel();
  renderQueue = renderQueue.catch(() => {}).then(() => renderPage(generation)).catch(error => {
    if (generation === renderGeneration && error?.name !== 'RenderingCancelledException') {
      failed.value = true;
      emit('error', error);
    }
  });
}

async function loadPdf(bytes) {
  if(canvasElement.value)canvasElement.value.dataset.rendered='false';
  const generation = ++documentGeneration;
  loading.value = bytes instanceof Uint8Array && bytes.byteLength > 0;
  await releaseDocument();
  if (generation !== documentGeneration) return;
  failed.value = false;
  pageNumber.value = 1;
  totalPages.value = 0;
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
    totalPages.value = documentProxy.numPages;
    loading.value = false;
    emit('ready', { pages: documentProxy.numPages });
    scheduleRender();
  } catch (error) {
    if (generation === documentGeneration) {
      loading.value = false;
      failed.value = true;
      emit('error', error);
    }
  }
}

function previousPage() {
  if (pageNumber.value <= 1) return;
  pageNumber.value -= 1;
  scheduleRender();
}

function nextPage() {
  if (pageNumber.value >= totalPages.value) return;
  pageNumber.value += 1;
  scheduleRender();
}

watch(() => props.bytes, loadPdf, { immediate: true, flush: 'post' });

onMounted(() => {
  resizeObserver = new ResizeObserver(scheduleRender);
  if (viewportElement.value) resizeObserver.observe(viewportElement.value);
});

onBeforeUnmount(async () => {
  documentGeneration += 1;
  resizeObserver?.disconnect();
  await releaseDocument();
});
</script>

<template>
  <section class="pdf-viewer" :aria-label="t('PDF 预览')">
    <header class="pdf-viewer__toolbar">
      <div class="pdf-viewer__navigation">
        <button class="fluent-button" type="button" :disabled="pageNumber <= 1 || loading" :aria-label="t('上一页')" @click="previousPage">‹</button>
        <span class="pdf-viewer__page-count" aria-live="polite">{{ pageLabel }}</span>
        <button class="fluent-button" type="button" :disabled="pageNumber >= totalPages || loading" :aria-label="t('下一页')" @click="nextPage">›</button>
      </div>
      <select v-model="zoom" class="fluent-select__control pdf-viewer__zoom" :aria-label="t('PDF 缩放')" @change="scheduleRender">
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
      <canvas v-show="!loading && !failed && totalPages" ref="canvasElement" class="pdf-viewer__canvas" />
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

.pdf-viewer__page-count {
  min-width: 9em;
  text-align: center;
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.pdf-viewer__zoom {
  width: 150px;
  flex: 0 0 150px;
}

.pdf-viewer__viewport {
  display: flex;
  min-height: 0;
  flex: 1;
  align-items: flex-start;
  justify-content: center;
  overflow: auto;
  padding: 16px;
  background: var(--fluent-bg, #f4f5f6);
}

.pdf-viewer__canvas {
  display: block;
  flex: 0 0 auto;
  max-width: none;
  background: #fff;
  box-shadow: 0 2px 12px rgb(0 0 0 / 16%);
}

.pdf-viewer__message {
  align-self: center;
  margin: auto;
  color: var(--fluent-muted, #616161);
}

.pdf-viewer__message--error {
  color: var(--fluent-error, #b10e1c);
}

@media (max-width: 420px) {
  .pdf-viewer__toolbar {
    gap: 6px;
    padding-inline: 6px;
  }

  .pdf-viewer__page-count {
    min-width: 7em;
    font-size: 0.75rem;
  }

  .pdf-viewer__zoom {
    width: 110px;
    flex-basis: 110px;
    min-width: 0;
  }
}
</style>
