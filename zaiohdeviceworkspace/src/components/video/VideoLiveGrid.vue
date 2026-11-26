<template>
  <div class="preview-toolbar">
    <label for="preview-channels">预览通道</label>
    <el-select id="preview-channels" :model-value="modelValue" aria-label="预览通道" multiple
      :multiple-limit="4" collapse-tags :max-collapse-tags="2" placeholder="选择通道（最多 4 路）"
      @update:model-value="$emit('update:modelValue', $event)">
      <el-option v-for="channel in workspace.channels" :key="channel.id" :value="channel.id" :label="channel.name" />
    </el-select>
    <el-button :icon="FullScreen" @click="showGridFullscreen">全屏展示</el-button>
  </div>

  <div ref="grid" class="preview-grid" :class="{ 'is-focused': focused }" aria-label="实时视频画面">
    <button class="exit-fullscreen" type="button" @click="toggleFullscreen(grid)">退出全屏</button>
    <template v-for="(channel, index) in slots" :key="channel?.id ?? index">
      <VideoLiveTile v-if="channel" v-show="!focused || focused === channel.id" :channel="channel"
        :diagnostic="workspace.diagnostics[channel.id]" :live-frame="frames[channel.id]" :models="workspace.models"
        :busy="busy" :focused="focused === channel.id"
        :fullscreen="fullscreenChannel === channel.id" :stream-image="streamImages[channel.id] || ''"
        :stream-retrying="streamRetrying" :stream-error="streamError" @focus="toggleFocus(channel.id)"
        @fullscreen="toggleFullscreen" @control="action => $emit('control', channel.id, action)" />
      <div v-else v-show="!focused" class="empty-tile">
        <router-link class="configure-link" :to="{ name: 'videoRecognition', query: { view: 'settings' } }">
          去配置通道
        </router-link>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { FullScreen } from '@element-plus/icons-vue';
import VideoLiveTile from './VideoLiveTile.vue';
import { readPreviewMultipart } from './previewMultiplex';
import { demoEnabled } from '@/demo/data';
import { OpenDemoPreview } from '@/demo/preview';

const props = defineProps({
  modelValue: { type: Array, required: true },
  workspace: { type: Object, required: true },
  frames: { type: Object, default: () => ({}) },
  busy: Boolean,
});
const emit = defineEmits(['update:modelValue', 'control', 'error']);
const grid = ref(null);
const focused = ref('');
const fullscreenChannel = ref('');
const streamImages = shallowRef({});
const streamRetrying = ref(false);
const streamError = ref('');
const imageURLs = new Map();
let streamController;
let reconnectTimer;
let reconnectAttempt = 0;
let componentMounted = false;
const slots = computed(() => Array.from({ length: 4 }, (_, index) =>
  props.workspace.channels.find(channel => channel.id === props.modelValue[index]) ?? null));
const streamMode = computed(() => focused.value || fullscreenChannel.value ? 'focus' : 'grid');
const streamChannels = computed(() => {
  let ids = props.modelValue.filter(Boolean);
  if (focused.value) ids = [focused.value];
  else if (fullscreenChannel.value) ids = [fullscreenChannel.value];
  return ids.filter(id => ['running', 'reconnecting'].includes(props.workspace.diagnostics[id]?.state));
});
const streamKey = computed(() => streamMode.value + ':' + streamChannels.value.join(','));

watch(() => props.modelValue, ids => {
  if (!ids.includes(focused.value)) focused.value = '';
});

watch(streamKey, () => {
  if (componentMounted) connectPreviewStream();
});

function toggleFocus(id) {
  focused.value = focused.value === id ? '' : id;
}

function showGridFullscreen() {
  focused.value = '';
  void toggleFullscreen(grid.value);
}

async function toggleFullscreen(element) {
  if (!element?.requestFullscreen) {
    emit('error', '当前浏览器不支持全屏展示。');
    return;
  }
  try {
    if (document.fullscreenElement === element) await document.exitFullscreen();
    else await element.requestFullscreen();
  } catch {
    emit('error', '进入或退出全屏失败，请重试。');
  }
}

function updateFullscreen() {
  fullscreenChannel.value = document.fullscreenElement?.dataset.channelId || '';
}

function releaseImage(channel, delay = 0) {
  const url = imageURLs.get(channel);
  if (!url) return;
  imageURLs.delete(channel);
  setTimeout(() => URL.revokeObjectURL(url), delay);
}

function setPreviewImage(channel, jpeg) {
  releaseImage(channel, 1000);
  const url = URL.createObjectURL(new Blob([jpeg], { type: 'image/jpeg' }));
  imageURLs.set(channel, url);
  streamImages.value = { ...streamImages.value, [channel]: url };
}

function clearPreviewImages() {
  for (const channel of [...imageURLs.keys()]) releaseImage(channel);
  streamImages.value = {};
}

function closePreviewStream() {
  clearTimeout(reconnectTimer);
  reconnectTimer = undefined;
  streamController?.abort();
  streamController = undefined;
}

function schedulePreviewReconnect() {
  if (!componentMounted || !streamChannels.value.length) return;
  streamRetrying.value = true;
  clearTimeout(reconnectTimer);
  const delay = Math.min(8000, 500 * (2 ** reconnectAttempt));
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(connectPreviewStream, delay);
}

async function connectPreviewStream() {
  closePreviewStream();
  if (!componentMounted) return;
  const ids = streamChannels.value;
  streamImages.value = Object.fromEntries(Object.entries(streamImages.value).filter(([id]) => ids.includes(id)));
  for (const id of imageURLs.keys()) {
    if (!ids.includes(id)) {
      releaseImage(id);
    }
  }
  if (!ids.length) {
    streamRetrying.value = false;
    streamError.value = '';
    return;
  }
  const token = localStorage.getItem('loginToken');
  if (!token) return;
  const controller = new AbortController();
  streamController = controller;
  streamRetrying.value = false;
  streamError.value = '';
  const query = new URLSearchParams({
    channels: ids.join(','), mode: streamMode.value, fps: streamMode.value === 'grid' ? '8' : '12'
  });
  try {
    const requestPreview = demoEnabled ? OpenDemoPreview : fetch;
    const response = await requestPreview('/api/video/preview.stream?' + query, {
      headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', signal: controller.signal
    });
    if (!response.ok) {
      let message = '视频预览连接失败';
      try {
        const payload = await response.json();
        message = payload.error || payload.msg || message;
      } catch {
        // 服务端未返回 JSON 时保留默认提示。
      }
      throw new Error(message);
    }
    let receivedFrame = false;
    await readPreviewMultipart(response, (headers, jpeg) => {
      if (controller.signal.aborted || !ids.includes(headers['x-frame-channel'])) {
        return;
      }
      if (!receivedFrame) {
        receivedFrame = true;
        reconnectAttempt = 0;
      }
      setPreviewImage(headers['x-frame-channel'], jpeg);
    }, controller.signal);
    if (!controller.signal.aborted) throw new Error('视频预览连接已结束');
  } catch (problem) {
    if (controller.signal.aborted || !componentMounted) return;
    streamError.value = problem.message || '视频预览连接失败';
    schedulePreviewReconnect();
  }
}

onMounted(() => {
  componentMounted = true;
  document.addEventListener('fullscreenchange', updateFullscreen);
  connectPreviewStream();
});
onUnmounted(() => {
  componentMounted = false;
  document.removeEventListener('fullscreenchange', updateFullscreen);
  closePreviewStream();
  clearPreviewImages();
});
</script>

<style scoped>
.preview-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  margin-bottom: 14px;
  border: 1px solid #dce5ee;
  border-radius: 8px;
  background: #fff;
}
.preview-toolbar .el-select { width: min(320px, 100%); }
.preview-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px;
  border: 2px solid #4a5564;
  border-radius: 8px;
  overflow: hidden;
  background: #4a5564;
}
.preview-grid.is-focused { grid-template-columns: minmax(0, 1fr); }
.preview-grid:fullscreen {
  grid-template-rows: repeat(2, minmax(0, 1fr));
  width: 100%;
  height: 100%;
  border-radius: 0;
}
.preview-grid:fullscreen.is-focused { grid-template-rows: minmax(0, 1fr); }
.empty-tile { display: grid; place-items: center; aspect-ratio: 16 / 9; background: #000; }
.preview-grid:fullscreen > * { aspect-ratio: auto; }
.configure-link, .exit-fullscreen {
  border: 1px solid #8b99ab;
  border-radius: 5px;
  background: #182534;
  color: #fff;
  padding: 8px 12px;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}
.configure-link { opacity: 0; }
.empty-tile:hover .configure-link, .configure-link:focus-visible { opacity: 1; }
.exit-fullscreen { display: none; position: absolute; top: 8px; left: 50%; transform: translateX(-50%); z-index: 3; }
.preview-grid:fullscreen > .exit-fullscreen { display: block; }
@media (hover: none) { .configure-link { opacity: 1; } }
@media (max-width: 620px) {
  .preview-toolbar .el-select { flex: 1 1 160px; }
  .empty-tile { min-height: 142px; }
}
</style>
