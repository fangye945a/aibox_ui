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
        :subscribed="(!focused || focused === channel.id) && (!fullscreenChannel || fullscreenChannel === channel.id)"
        :fullscreen="fullscreenChannel === channel.id" @focus="toggleFocus(channel.id)"
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { FullScreen } from '@element-plus/icons-vue';
import VideoLiveTile from './VideoLiveTile.vue';

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
const slots = computed(() => Array.from({ length: 4 }, (_, index) =>
  props.workspace.channels.find(channel => channel.id === props.modelValue[index]) ?? null));

watch(() => props.modelValue, ids => {
  if (!ids.includes(focused.value)) focused.value = '';
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

onMounted(() => document.addEventListener('fullscreenchange', updateFullscreen));
onUnmounted(() => document.removeEventListener('fullscreenchange', updateFullscreen));
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
