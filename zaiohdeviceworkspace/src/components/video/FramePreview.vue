<template>
  <figure v-if="stream || image" class="preview" :class="{ 'preview-fit': fit }">
    <div class="picture" :style="pictureStyle">
      <img v-if="stream" :src="stream" alt="设备实时预览画面" :class="{ reconnecting }"
        @load="$emit('stream-connected')" @error="$emit('stream-error')">
      <img v-else :src="image" alt="设备预览帧">
      <template v-if="frame && frame.annotated === false">
        <div v-for="(item, index) in frame.detections" :key="index" class="box"
          :class="{ hat: item.class === 'hat' }" :style="position(item.box)">
          <span>{{ item.class }} {{ (item.confidence * 100).toFixed(1) }}%</span>
        </div>
      </template>
      <div v-if="stream && !frame" class="stream-waiting">正在连接视频流…</div>
      <div v-if="(stream || image) && reconnecting" class="stream-waiting">视频连接中断，正在重连…</div>
    </div>
    <figcaption v-if="!fit && frame">帧 {{ frame.sequence }} · 源时间 {{ frame.ptsMs }} ms · {{ frame.width }} × {{ frame.height }}</figcaption>
  </figure>
  <div v-else class="placeholder" :class="{ 'placeholder-fit': fit }">{{ emptyText }}</div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  frame: { type: Object, default: null },
  image: { type: String, default: '' },
  stream: { type: String, default: '' },
  reconnecting: Boolean,
  fit: Boolean,
  emptyText: { type: String, default: '等待设备预览帧' }
});
defineEmits(['stream-connected', 'stream-error']);

const pictureStyle = computed(() => {
  if (!props.frame?.width || !props.frame?.height) return { aspectRatio: '16 / 9', '--frame-ratio': 16 / 9 };
  return {
    aspectRatio: props.frame.width + '/' + props.frame.height,
    '--frame-ratio': props.frame.width / props.frame.height
  };
});

function position([x1, y1, x2, y2]) {
  const { width, height } = props.frame;
  return {
    left: (x1 / width * 100) + '%', top: (y1 / height * 100) + '%',
    width: ((x2 - x1) / width * 100) + '%', height: ((y2 - y1) / height * 100) + '%'
  };
}
</script>

<style scoped>
.preview { margin: 0; }
.picture { position: relative; background: #101923; width: 100%; overflow: hidden; }
.picture img { display: block; width: 100%; height: 100%; object-fit: contain; }
.picture img.reconnecting { opacity: .82; }
.preview-fit, .placeholder-fit { position: absolute; inset: 0; display: grid; place-items: center; min-height: 0; background: #000; }
.preview-fit { container-type: size; }
.preview-fit .picture { width: min(100%, calc(100cqh * var(--frame-ratio))); }
.box { position: absolute; border: 2px solid #3af4b8; color: #07201b; }
.box.hat { border-color: #ffd269; color: #2b1900; }
.box span {
  position: absolute;
  top: 0;
  left: 0;
  color: #f7fafc;
  background: rgb(12 19 28 / 88%);
  border: 1px solid #3af4b8;
  border-radius: 6px;
  padding: 3px 7px;
  font: 600 11px/1.25 sans-serif;
  white-space: nowrap;
  box-shadow: 0 5px 16px rgb(0 0 0 / 24%);
  backdrop-filter: blur(8px);
}
.box.hat span { border-color: #ffd269; }
.stream-waiting {
  position: absolute;
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  max-width: calc(100% - 24px);
  padding: 7px 10px;
  border-radius: 5px;
  color: #fff;
  background: rgb(14 22 33 / 82%);
  font-size: 12px;
  white-space: nowrap;
}
figcaption { font-size: 12px; color: #50657d; padding: 10px 0 0; }
.placeholder { min-height: 300px; display: grid; place-items: center; background: #101923; color: #cedae7; border-radius: 6px; }
</style>
