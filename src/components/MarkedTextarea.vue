<script setup>
// A textarea whose text is drawn by a layer underneath, as in CASSIE's editor, so each part of the text can carry an
// underline. While an input method composes, the textarea shows its own text instead. An optional gutter labels lines.
import {computed, nextTick, onBeforeUnmount, onMounted, ref, watch} from 'vue';

const props = defineProps({
  modelValue: {type: String, default: ''},
  spans: {type: Array, default: () => []},
  active: {type: Number, default: -1},
  label: {type: String, default: ''},
  inputId: {type: String, default: undefined},
  placeholder: {type: String, default: ''},
  gutter: {type: Array, default: null},
  minRows: {type: Number, default: 4}
});
const emit = defineEmits(['update:modelValue', 'caret']);

const field = ref(null), mirror = ref(null);
const scroll = ref({top: 0, left: 0, bar: 0});
const composing = ref(false);
const rowHeights = ref([]);
const textLines = computed(() => props.modelValue.split('\n'));

function sync() {
  const element = field.value;
  if (!element) return;
  const style = getComputedStyle(element);
  scroll.value = {top: element.scrollTop, left: element.scrollLeft, bar: Math.max(0, element.offsetWidth - element.clientWidth - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth))};
}
// The box grows with its text up to its maximum height; a gutter row is as tall as its wrapped line.
function fit() {
  const element = field.value;
  if (!element) return;
  element.style.height = 'auto';
  element.style.height = `${element.scrollHeight + element.offsetHeight - element.clientHeight}px`;
  if (props.gutter) rowHeights.value = Array.from(mirror.value?.children ?? [], row => row.offsetHeight);
  sync();
}
function caret() {
  sync();
  emit('caret', field.value?.selectionStart ?? -1);
}
function input(event) {
  emit('update:modelValue', event.target.value);
  if (!composing.value) caret();
}
function endComposition(event) {
  composing.value = false;
  emit('update:modelValue', event.target.value);
  nextTick(caret);
}
function select(start, end) {
  const element = field.value;
  if (!element) return;
  element.focus({preventScroll: true});
  element.setSelectionRange(start, end);
  caret();
}
defineExpose({select, focus: () => field.value?.focus()});

watch(() => props.modelValue, () => nextTick(fit));
watch(() => props.gutter, () => nextTick(fit));
let observer = null;
onMounted(() => {
  fit();
  if (typeof ResizeObserver === 'function' && field.value) { observer = new ResizeObserver(fit); observer.observe(field.value); }
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div class="marked" :class="{'has-gutter': gutter, 'is-composing': composing}" :style="{'--min-rows': minRows, '--bar': `${scroll.bar}px`}">
    <div v-if="gutter" class="marked__gutter" aria-hidden="true">
      <div class="marked__gutter-rows" :style="{transform: `translateY(${-scroll.top}px)`}"><div v-for="(item, index) in textLines" :key="index" class="marked__gutter-row" :class="gutter[index]?.kind" :style="{height: rowHeights[index] ? `${rowHeights[index]}px` : undefined}">{{ gutter[index]?.label ?? '' }}</div></div>
    </div>
    <div class="marked__field">
      <div v-if="gutter" ref="mirror" class="marked__mirror" aria-hidden="true"><div v-for="(line, index) in textLines" :key="index">{{ line || ' ' }}</div></div>
      <textarea :id="inputId" ref="field" :value="modelValue" class="fluent-field__input" spellcheck="false" autocomplete="off" :aria-label="label" :placeholder="placeholder" @input="input" @compositionstart="composing = true" @compositionend="endComposition" @scroll="sync" @click="caret" @keyup="caret" @select="caret" @focus="caret" />
      <div class="marked__layer" aria-hidden="true"><pre :style="{transform: `translate(${-scroll.left}px, ${-scroll.top}px)`}"><span v-for="(span, index) in spans" :key="index" :class="[`mark-${span.kind}`, {'is-active': span.group >= 0 && span.group === active}]">{{ span.text }}</span>{{ ' ' }}</pre></div>
    </div>
  </div>
</template>

<style scoped>
.marked{display:grid;grid-template-columns:minmax(0,1fr);--font:14px/26px system-ui,-apple-system,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif}
.marked.has-gutter{grid-template-columns:auto minmax(0,1fr)}
/* The gutter scrolls with the text but never sets the height of the editor. */
.marked__gutter{position:relative;overflow:hidden;width:34px;color:var(--fluent-muted,rgb(93 93 93));font:11px/26px system-ui,sans-serif;text-align:right;user-select:none}
.marked__gutter-rows{position:absolute;top:7px;left:0;right:6px}
.marked__gutter-row{min-height:26px;white-space:nowrap}
.marked__gutter-row.is-wrong{color:var(--fluent-danger,#c42b1c);font-weight:600}
.marked__gutter-row.is-changed{color:var(--fluent-accent,#0067c0);font-weight:600}
.marked__field{position:relative;min-width:0}
.marked__field textarea,.marked__layer pre,.marked__mirror{box-sizing:border-box;margin:0;padding:6px 8px;font:var(--font);letter-spacing:0;white-space:pre-wrap;overflow-wrap:anywhere;tab-size:2}
.marked__field textarea{position:relative;display:block;width:100%;min-height:calc(var(--min-rows) * 26px + 14px);max-height:min(60vh,520px);overflow-y:auto;border-width:1px;resize:none;color:transparent;caret-color:var(--fluent-text,rgb(27 27 27));background:var(--fluent-surface,#fff)}
.marked__field textarea::placeholder{color:var(--fluent-muted,rgb(93 93 93))}
.marked__field textarea::selection{color:transparent;background:var(--fluent-selection,rgb(0 103 192 / .25))}
.marked__mirror{position:absolute;top:0;left:0;right:var(--bar,0px);visibility:hidden;pointer-events:none;border:1px solid transparent}
.marked__layer{position:absolute;inset:1px calc(1px + var(--bar,0px)) 1px 1px;overflow:hidden;pointer-events:none}
.marked__layer pre{min-height:100%;color:var(--fluent-text,rgb(27 27 27));border:0}
.marked.is-composing textarea{color:var(--fluent-text,rgb(27 27 27))}
.marked.is-composing .marked__layer{visibility:hidden}
.marked__layer span{text-decoration-line:underline;text-decoration-thickness:2px;text-underline-offset:5px;text-decoration-skip-ink:none}
.marked__layer span.is-active{background:var(--fluent-selection,rgb(0 103 192 / .18));border-radius:2px}
@media(max-width:700px){.marked{--font:16px/28px system-ui,-apple-system,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif}.marked__gutter{line-height:28px}.marked__gutter-row{min-height:28px}.marked__field textarea{min-height:calc(var(--min-rows) * 28px + 14px)}}
</style>

<style>
/* Shared by every lyric layout: what each underline means. */
.mark-plain,.mark-skipped,.mark-same{text-decoration-line:none!important}
.mark-skipped{color:var(--fluent-muted,rgb(93 93 93))}
.mark-exact{text-decoration-color:var(--fluent-success,#0f7b0f)}
.mark-high,.mark-change{text-decoration-color:var(--fluent-accent,#0067c0)}
.mark-low{text-decoration-color:var(--fluent-warning,#9d5d00);text-decoration-style:dashed}
.mark-none{text-decoration-color:var(--fluent-danger,#c42b1c);text-decoration-style:wavy;text-decoration-thickness:1.5px}
.mark-order{text-decoration-color:var(--fluent-accent,#0067c0);text-decoration-style:dotted}
.mark-swatch{display:inline-block;width:22px;margin-right:4px;color:transparent;text-decoration-line:underline;text-decoration-thickness:2px;text-underline-offset:3px;text-decoration-skip-ink:none}
</style>
