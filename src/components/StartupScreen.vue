<script setup>
import {t} from '../i18n.js';

// Startup checks run by App: each step is {id, label, status: 'pending' | 'ok' | 'warn' | 'fail', detail}.
defineProps({steps: {type: Array, default: () => []}, ready: Boolean});
const marks = {pending: '', ok: '✓', warn: '!', fail: '×'};
</script>

<template>
  <div class="startup" role="status" aria-live="polite" :aria-busy="!ready">
    <a class="startup__menu fluent-button fluent-button--subtle" href="/" :aria-label="t('返回 Tiny Projects 主菜单')"><span aria-hidden="true">←</span>{{ t('返回主菜单') }}</a>
    <div class="startup__card">
      <svg class="startup__logo" viewBox="0 0 64 64" aria-hidden="true">
        <defs><linearGradient id="startup-logo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b9cec"/><stop offset="1" stop-color="#1c5ea8"/></linearGradient></defs>
        <rect class="startup__tile" width="64" height="64" rx="15" fill="url(#startup-logo)"/>
        <g class="startup__staff" stroke="#fff" stroke-opacity=".3" stroke-width="2"><path d="M9 30.5h46"/><path d="M9 38.5h46"/><path d="M9 46.5h46"/></g>
        <g class="startup__note" fill="#fff"><ellipse cx="25" cy="46.5" rx="8.5" ry="6.5" transform="rotate(-22 25 46.5)"/><rect x="30" y="16.5" width="4" height="30" rx="2"/></g>
        <g class="startup__waves" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"><path d="M36.5 17.14A7 7 0 0 1 36.5 27.86"/><path d="M40.36 12.54A13 13 0 0 1 40.36 32.46"/></g>
      </svg>
      <h1 class="startup__name">{{ t('织音机') }}</h1>
      <ol class="startup__steps">
        <li v-for="step in steps" :key="step.id" class="startup__step" :data-status="step.status">
          <span class="startup__mark" aria-hidden="true">{{ marks[step.status] }}</span>
          <span class="startup__label">{{ step.label }}<small v-if="step.detail">{{ step.detail }}</small></span>
        </li>
      </ol>
      <p class="startup__status">{{ t(ready ? '准备就绪' : '正在启动') }}</p>
    </div>
  </div>
</template>

<style scoped>
.startup{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:24px 16px;overflow:auto;background:var(--fluent-bg);color:var(--fluent-text)}
.startup__menu{position:fixed;top:max(14px,env(safe-area-inset-top));right:max(16px,env(safe-area-inset-right));display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 10px;font-size:12px;text-decoration:none;box-shadow:none}
.startup__card{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(100%,320px)}
.startup__logo{width:88px;height:88px;overflow:visible}
.startup__tile{transform-origin:32px 32px;animation:startup-tile .45s cubic-bezier(.2,.8,.2,1) both}
.startup__staff path{stroke-dasharray:46;stroke-dashoffset:46;animation:startup-draw .5s ease-out forwards}
.startup__staff path:nth-child(2){animation-delay:.12s}
.startup__staff path:nth-child(3){animation-delay:.24s}
.startup__note{transform-origin:25px 46px;animation:startup-note .4s .45s cubic-bezier(.2,.9,.3,1.3) both}
.startup__waves path{opacity:0;animation:startup-wave 1.4s .8s ease-in-out infinite}
.startup__waves path:nth-child(2){animation-delay:1s}
.startup__name{margin:0;font-size:22px;font-weight:600;letter-spacing:.08em}
.startup__steps{display:grid;gap:7px;width:100%;margin:6px 0 0;padding:0;list-style:none;font-size:12px}
.startup__step{display:grid;grid-template-columns:18px 1fr;align-items:start;gap:8px;color:var(--fluent-muted);animation:startup-step .25s ease-out both}
.startup__step[data-status=ok],.startup__step[data-status=pending]{color:var(--fluent-text)}
.startup__mark{display:grid;place-items:center;width:16px;height:16px;margin-top:1px;border-radius:50%;font-size:10px;font-weight:700;color:#fff}
.startup__step[data-status=pending] .startup__mark{border:2px solid var(--fluent-border);border-top-color:var(--fluent-accent);animation:startup-spin .7s linear infinite}
.startup__step[data-status=ok] .startup__mark{background:var(--fluent-success)}
.startup__step[data-status=warn] .startup__mark{background:#c27c0e}
.startup__step[data-status=fail] .startup__mark{background:var(--fluent-danger)}
.startup__label small{display:block;margin-top:2px;font-size:11px;color:var(--fluent-muted)}
.startup__status{margin:4px 0 0;font-size:11px;letter-spacing:.12em;color:var(--fluent-muted)}
@keyframes startup-tile{from{opacity:0;transform:scale(.7)}}
@keyframes startup-draw{to{stroke-dashoffset:0}}
@keyframes startup-note{from{opacity:0;transform:translateY(8px) scale(.6)}}
@keyframes startup-wave{0%,100%{opacity:0}40%,60%{opacity:1}}
@keyframes startup-step{from{opacity:0;transform:translateY(4px)}}
@keyframes startup-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){
  .startup__tile,.startup__note,.startup__step{animation:none}
  .startup__staff path{animation:none;stroke-dashoffset:0}
  .startup__waves path{animation:none;opacity:1}
  .startup__step[data-status=pending] .startup__mark{animation:none}
}
</style>
