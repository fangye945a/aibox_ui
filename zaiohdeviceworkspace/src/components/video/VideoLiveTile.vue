<template>
  <article ref="tile" class="preview-tile" :class="{ 'is-focused': focused }" :data-channel-id="channel.id"
    :aria-label="channel.name" @dblclick="!fullscreen && $emit('focus')">
    <FramePreview :frame="frame" :stream="streamUrl" :reconnecting="streamRetrying"
      :empty-text="previewError || diagnostic?.error || stateLabel(diagnostic?.state)" fit
      @stream-connected="handleStreamConnected" @stream-error="scheduleStreamReconnect" />
    <div class="tile-header" @dblclick.stop>
      <div class="tile-name">
        <strong :title="channel.name">{{ channel.name }}</strong>
        <small v-if="channel.location" :title="channel.location">{{ channel.location }}</small>
      </div>
      <button type="button" class="tile-action" :disabled="busy" @click="$emit('control', active(diagnostic) ? 'stop' : 'start')">
        {{ active(diagnostic) ? '停止分析' : '启动分析' }}
      </button>
    </div>
    <div v-if="showDetails && (focused || fullscreen) && frame" class="tile-details" @dblclick.stop>
      <strong>检测结果 · 帧 {{ frame.sequence }}</strong>
      <p v-if="!frame.detections?.length">当前帧无符合阈值的检测</p>
      <ul v-else>
        <li v-for="(item, index) in frame.detections" :key="index">
          {{ item.class }} {{ (item.confidence * 100).toFixed(1) }}% · {{ modelName(item.model) }}
        </li>
      </ul>
    </div>
    <div class="tile-footer" @dblclick.stop>
      <span class="tile-status">{{ stateLabel(diagnostic?.state) }} · {{ fps(diagnostic?.inferenceFps) }} FPS</span>
      <div class="tile-tools">
        <button v-if="frame && (focused || fullscreen)" type="button" class="tile-action"
          :aria-expanded="showDetails" @click="showDetails = !showDetails">检测结果</button>
        <button type="button" class="tile-action fullscreen-action"
          :title="fullscreen ? '退出全屏' : '通道全屏'"
          :aria-label="fullscreen ? '退出全屏' : channel.name + ' 全屏'"
          @click="$emit('fullscreen', tile)">
          <el-icon><FullScreen /></el-icon>
        </button>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { FullScreen } from '@element-plus/icons-vue';
import FramePreview from './FramePreview.vue';
import { active, fps, stateLabel } from './videoStatus';
import { demoEnabled } from '@/demo/data';
import { demoVideoScene } from '@/demo/video';

const props = defineProps({
  channel: { type: Object, required: true },
  diagnostic: Object,
  liveFrame: Object,
  models: { type: Array, required: true },
  busy: Boolean,
  focused: Boolean,
  subscribed: Boolean,
  fullscreen: Boolean,
});
defineEmits(['control', 'focus', 'fullscreen']);

const tile = ref(null);
const frame = computed(() => props.liveFrame || null);
const streamUrl = ref('');
const streamRetrying = ref(false);
const previewError = ref('');
const showDetails = ref(false);
const modelName = id => props.models.find(model => model.id === id)?.name || id;
let reconnectTimer;
let reconnectAttempt = 0;

function streamPath() {
  if (demoEnabled) return demoVideoScene(props.channel);
  const query = new URLSearchParams({ fps: '12', stream: String(Date.now()) });
  return '/api/video/channels/' + encodeURIComponent(props.channel.id) + '/preview.mjpeg?' + query;
}

function connectStream() {
  clearTimeout(reconnectTimer);
  reconnectTimer = undefined;
  streamUrl.value = streamPath();
}

function closeStream() {
  clearTimeout(reconnectTimer);
  reconnectTimer = undefined;
  streamUrl.value = '';
  streamRetrying.value = false;
}

function handleStreamConnected() {
  reconnectAttempt = 0;
  streamRetrying.value = false;
  previewError.value = '';
}

function scheduleStreamReconnect() {
  if (!props.subscribed || !['running', 'reconnecting', 'ended'].includes(props.diagnostic?.state)) return;
  streamRetrying.value = true;
  previewError.value = '视频连接中断，正在重连';
  clearTimeout(reconnectTimer);
  const delay = Math.min(8000, 500 * (2 ** reconnectAttempt));
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(connectStream, delay);
}

watch(() => props.channel.id, () => {
  closeStream();
});

watch([() => props.subscribed, () => props.diagnostic?.state], ([subscribed, state]) => {
  if (!subscribed || !['running', 'reconnecting', 'ended'].includes(state)) {
    closeStream();
    return;
  }
  previewError.value = '';
  connectStream();
}, { immediate: true });

onUnmounted(() => {
  closeStream();
});
</script>

<style scoped>
.preview-tile {
  position: relative;
  min-width: 0;
  min-height: 0;
  aspect-ratio: 16 / 9;
  background: #000;
  color: #fff;
  overflow: hidden;
}
.preview-tile.is-focused { aspect-ratio: auto; height: clamp(240px, 65vh, 880px); }
.preview-tile:fullscreen { width: 100%; height: 100%; }
.tile-header, .tile-footer {
  position: absolute;
  inset-inline: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 8px;
  pointer-events: none;
}
.tile-header { top: 0; }
.tile-footer { bottom: 0; align-items: flex-end; }
.tile-tools { display: flex; align-items: flex-end; gap: 6px; }
.tile-details {
  position: absolute;
  right: 8px;
  bottom: 50px;
  max-width: calc(100% - 16px);
  max-height: min(220px, 50%);
  overflow: auto;
  background: rgb(14 22 33 / 93%);
  padding: 10px;
  border-radius: 5px;
}
.tile-details ul { margin: 6px 0 0; padding-inline-start: 18px; }
.tile-details p { margin: 6px 0 0; }
.tile-name, .tile-status, .tile-action { background: rgb(14 22 33 / 85%); border-radius: 5px; color: #fff; }
.tile-name, .tile-status { padding: 5px 7px; font-size: 12px; min-width: 0; }
.tile-name { display: grid; gap: 2px; }
.tile-name strong, .tile-name small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tile-name small { color: #c9d5e2; }
.tile-action { pointer-events: auto; border: 1px solid #8392a4; padding: 5px 7px; font: inherit; font-size: 12px; cursor: pointer; white-space: nowrap; }
.tile-action:disabled { opacity: .6; cursor: default; }
.fullscreen-action { display: grid; place-items: center; width: 34px; height: 34px; font-size: 17px; }
@media (max-width: 620px) {
  .preview-tile { min-height: 142px; }
  .tile-header, .tile-footer { padding: 4px; gap: 4px; }
  .tile-name, .tile-status, .tile-action { font-size: 11px; }
}
</style>
