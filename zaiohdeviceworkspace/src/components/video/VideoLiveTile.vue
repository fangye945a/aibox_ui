<template>
  <article ref="tile" class="preview-tile" :class="{ 'is-focused': focused }" :data-channel-id="channel.id"
    :aria-label="channel.name" @dblclick="!fullscreen && $emit('focus')">
    <FramePreview :frame="frame" :image="streamImage" :reconnecting="streamRetrying"
      :empty-text="streamError || diagnostic?.error || stateLabel(diagnostic?.state)" fit />
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
import { computed, ref } from 'vue';
import { FullScreen } from '@element-plus/icons-vue';
import FramePreview from './FramePreview.vue';
import { active, fps, stateLabel } from './videoStatus';

const props = defineProps({
  channel: { type: Object, required: true },
  diagnostic: Object,
  liveFrame: Object,
  models: { type: Array, required: true },
  busy: Boolean,
  focused: Boolean,
  fullscreen: Boolean,
  streamImage: { type: String, default: '' },
  streamRetrying: Boolean,
  streamError: { type: String, default: '' },
});
defineEmits(['control', 'focus', 'fullscreen']);

const tile = ref(null);
const frame = computed(() => props.liveFrame || null);
const showDetails = ref(false);
const modelName = id => props.models.find(model => model.id === id)?.name || id;
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
  background: linear-gradient(145deg, rgb(17 27 41 / 91%), rgb(7 14 24 / 88%));
  border: 1px solid rgb(135 166 198 / 24%);
  box-shadow: 0 14px 38px rgb(0 0 0 / 32%), inset 0 1px rgb(255 255 255 / 8%);
  backdrop-filter: blur(14px) saturate(125%);
  padding: 12px 14px;
  border-radius: 12px;
}
.tile-details strong { display: block; margin-bottom: 4px; color: #f7fafc; font-size: 12px; letter-spacing: .02em; }
.tile-details ul { margin: 7px 0 0; padding: 0; list-style: none; display: grid; gap: 5px; }
.tile-details li { padding-left: 13px; position: relative; color: #dce8f5; font-size: 12px; line-height: 1.45; }
.tile-details li::before { content: ''; position: absolute; left: 2px; top: .58em; width: 4px; height: 4px; border-radius: 50%; background: #3ce2aa; box-shadow: 0 0 0 3px rgb(60 226 170 / 10%); }
.tile-details p { margin: 7px 0 0; color: #b9c8d8; font-size: 12px; }
.tile-name, .tile-status, .tile-action {
  background: rgb(9 17 28 / 78%);
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 8px;
  box-shadow: 0 5px 16px rgb(0 0 0 / 18%);
  color: #fff;
  backdrop-filter: blur(10px);
}
.tile-name, .tile-status { padding: 5px 7px; font-size: 12px; min-width: 0; }
.tile-name { display: grid; gap: 2px; }
.tile-name strong, .tile-name small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tile-name small { color: #c9d5e2; }
.tile-action { pointer-events: auto; padding: 5px 8px; font: inherit; font-size: 12px; cursor: pointer; white-space: nowrap; }
.tile-action:disabled { opacity: .6; cursor: default; }
.fullscreen-action { display: grid; place-items: center; width: 34px; height: 34px; font-size: 17px; }
@media (max-width: 620px) {
  .preview-tile { min-height: 142px; }
  .tile-header, .tile-footer { padding: 4px; gap: 4px; }
  .tile-name, .tile-status, .tile-action { font-size: 11px; }
}
</style>
