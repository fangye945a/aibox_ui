<!--
 Copyright (c) 2026 Hunan OpenValley Digital Industry Development Co., Ltd.
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
-->
<template>
    <section class="video-panel" :class="{ 'video-selected': selected }" :aria-label="channel.name">
        <div class="video-heading">
            <h2><el-button text :type="selected ? 'primary' : ''" :aria-pressed="selected" @click="$emit('select')">{{ channel.name }}</el-button></h2>
            <el-tag v-if="!previewOnly" size="small" :type="stateType">{{ VideoChannelStatus(channel) }}</el-tag>
        </div>
        <div ref="picture" class="video-picture" @click="$emit('select')" @dblclick="Fullscreen">
            <canvas ref="canvas" :width="WIDTH" :height="HEIGHT" :aria-label="`${channel.name}实时画面`"></canvas>
            <video ref="video" muted playsinline hidden @ended="Complete" @error="MediaFailed"></video>
            <div v-if="placeholder" class="video-placeholder"><el-icon :size="28"><VideoCamera /></el-icon>{{ placeholder }}</div>
            <el-button class="video-fullscreen" :icon="FullScreen" title="全屏" aria-label="全屏" circle size="small" @click.stop="Fullscreen" />
        </div>
        <p class="video-muted">{{ VideoSourceName(workspace, channel.source) }} · 预览 {{ browserSource ? localFps : paused ? 0 : channel.fps }} FPS</p>
        <p v-if="localState === 'completed'" class="video-muted">本地视频播放完成</p>
        <el-alert v-if="channel.error || localError" :title="channel.error || localError" type="error" :closable="false" show-icon />
        <div v-if="!previewOnly || browserSource" class="video-actions">
            <el-button size="small" @click="TogglePreview">{{ previewAction }}</el-button>
            <el-button v-if="!previewOnly && !browserSource" size="small" :type="channel.state !== 'running' ? 'primary' : ''" @click="ToggleTask">
                {{ { running: '停止检测', stopped: '启动检测', error: '重连检测' }[channel.state] }}
            </el-button>
        </div>
        <div v-if="!previewOnly" class="video-actions">
            <el-button link type="primary" @click="$emit('configure')">配置通道</el-button>
            <el-button link type="primary" @click="$emit('records')">查看记录</el-button>
            <el-button link type="primary" @click="$emit('diagnose')">通道诊断</el-button>
        </div>
    </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { FullScreen, VideoCamera } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { CompareFrames, DrawSample, SAMPLE_HEIGHT, SAMPLE_WIDTH } from '@/utils/video-motion';
import { DrawDetection, DrawModelSample } from '@/demo/video-recognition';
import { IsBrowserSource, StartVideoChannel, StopVideoChannel, VideoChannelStatus, VideoSourceName } from '@/demo/video-workspace';

const WIDTH = 640;
const HEIGHT = 360;
const props = defineProps({ channel: Object, workspace: Object, selected: Boolean, previewOnly: Boolean });
const emit = defineEmits(['select', 'configure', 'records', 'diagnose', 'local-frame', 'pause-preview']);
const channel = props.channel;
const canvas = ref(null);
const video = ref(null);
const picture = ref(null);
const paused = ref(false);
const localState = ref('idle');
const localError = ref('');
const localFrame = shallowRef(null);
const localFps = ref(0);
const browserSource = computed(() => IsBrowserSource(channel.source));
const stateType = computed(() => browserSource.value ? 'info' : ({ running: 'success', error: 'danger' }[channel.state] ?? 'info'));
const placeholder = computed(() => {
    if (browserSource.value) {
        return { idle: '本地预览未打开', opening: '正在打开本地预览', active: '', completed: '' }[localState.value];
    }
    return paused.value ? '预览已暂停' : props.previewOnly || channel.state === 'running' ? '' : VideoChannelStatus(channel);
});
const previewAction = computed(() => {
    if (browserSource.value) {
        return ['opening', 'active'].includes(localState.value) ? '关闭本地预览' : '打开本地预览';
    }
    return paused.value ? '恢复预览' : '暂停预览';
});
let stream = null;
let objectUrl = null;
let animation = 0;
let generation = 0;
let sequence = 0;

function Release() {
    generation++;
    cancelAnimationFrame(animation);
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    if (video.value && (video.value.srcObject || video.value.hasAttribute('src'))) {
        video.value.pause();
        video.value.srcObject = null;
        video.value.removeAttribute('src');
        video.value.load();
    }
    if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
    }
    localFrame.value = null;
    localFps.value = 0;
}

function CloseLocal() {
    localState.value = 'idle';
    Release();
}

function Complete() {
    if (localState.value === 'active') {
        CloseLocal();
        localState.value = 'completed';
    }
}

function MediaFailed() {
    if (['opening', 'active'].includes(localState.value)) {
        CloseLocal();
        localError.value = '无法读取本地视频，请检查文件编码或摄像头';
    }
}

function ReadMotion(context, timestamp, runtime) {
    if (timestamp - runtime.lastMotion >= channel.algorithm.interval) {
        runtime.lastMotion = timestamp;
        runtime.sample.drawImage(context.canvas, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
        const pixels = runtime.sample.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data;
        const region = runtime.pixels ? CompareFrames(runtime.pixels, pixels, channel.algorithm.sensitivity) : null;
        runtime.pixels = pixels;
        runtime.motion = region?.percent ?? 0;
        runtime.detections = region && region.percent >= channel.algorithm.minArea ? [{
            kind: 'motion', score: null, x: region.x * WIDTH, y: region.y * HEIGHT, width: region.width * WIDTH, height: region.height * HEIGHT
        }] : [];
    }
    return runtime.detections;
}

function PaintMedia(context, media) {
    const scale = Math.min(WIDTH / media.videoWidth, HEIGHT / media.videoHeight);
    const width = media.videoWidth * scale;
    const height = media.videoHeight * scale;
    context.fillStyle = '#17202a';
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.drawImage(media, (WIDTH - width) / 2, (HEIGHT - height) / 2, width, height);
}

function Render(context, timestamp, runtime) {
    animation = requestAnimationFrame(next => Render(context, next, runtime));
    if (timestamp - runtime.lastPaint < 64 || !runtime.media.videoWidth) {
        return;
    }
    PaintMedia(context, runtime.media);
    const { mode, showBox } = channel.algorithm;
    const detections = mode === 'motion' ? ReadMotion(context, timestamp, runtime) : [];
    if (showBox) {
        detections.forEach(item => DrawDetection(context, item));
    }
    localFrame.value = {
        sequence: ++sequence, elapsed: Math.round(runtime.media.currentTime * 1000), detections, motion: runtime.motion,
        inputWidth: runtime.media.videoWidth, inputHeight: runtime.media.videoHeight
    };
    localFps.value = Math.min(16, Math.round(1000 / Math.max(1, timestamp - runtime.lastPaint)));
    runtime.lastPaint = timestamp;
}

async function OpenMedia(source, request) {
    if (source.type === 'usb' && source.realUsb) {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('本机摄像头需要 HTTPS 或本机地址');
        }
        const [width, height] = source.resolution.split('x').map(Number);
        const constraints = { width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: source.fps } };
        if (source.deviceId) {
            constraints.deviceId = { exact: source.deviceId };
        }
        const input = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
        if (request !== generation) {
            input.getTracks().forEach(track => track.stop());
            return null;
        }
        stream = input;
        video.value.srcObject = input;
        return video.value;
    }
    if (source.type === 'mp4' && source.sourceId !== 'sample') {
        const file = props.workspace.sources.find(item => item.id === source.sourceId)?.file;
        if (!file) {
            throw new Error('视频文件已不可用，请重新上传或选择内置示例');
        }
        objectUrl = URL.createObjectURL(file);
        video.value.src = objectUrl;
        video.value.loop = source.loop;
        return video.value;
    }
    return null;
}

async function StartLocal() {
    CloseLocal();
    localError.value = '';
    const request = generation;
    localState.value = 'opening';
    try {
        const media = await OpenMedia(channel.source, request);
        if (request !== generation) {
            return;
        }
        await media.play();
        if (request !== generation) {
            return;
        }
        const sample = document.createElement('canvas');
        sample.width = SAMPLE_WIDTH;
        sample.height = SAMPLE_HEIGHT;
        const runtime = { media, lastPaint: -Infinity, lastMotion: -Infinity, detections: [], sample: sample.getContext('2d', { willReadFrequently: true }) };
        const context = canvas.value.getContext('2d');
        localState.value = 'active';
        animation = requestAnimationFrame(timestamp => Render(context, timestamp, runtime));
    } catch (error) {
        if (request === generation) {
            CloseLocal();
            localError.value = error.name === 'NotAllowedError' ? '浏览器本机摄像头权限未开启' : error.message || '本地视频源打开失败';
        }
    }
}

function TogglePreview() {
    if (!browserSource.value) {
        paused.value = !paused.value;
        emit('pause-preview', paused.value);
    } else if (['opening', 'active'].includes(localState.value)) {
        CloseLocal();
    } else {
        StartLocal();
    }
}

function ToggleTask() {
    if (channel.state === 'running') {
        StopVideoChannel(channel);
    } else {
        StartVideoChannel(props.workspace, channel);
    }
}

async function Fullscreen() {
    try {
        if (document.fullscreenElement === picture.value) {
            await document.exitFullscreen();
        } else {
            await picture.value.requestFullscreen();
        }
    } catch {
        ElMessage.warning('当前浏览器无法进入全屏');
    }
}

watch([() => channel.frame, paused], ([frame, isPaused]) => {
    if (!frame || isPaused || browserSource.value || !canvas.value) {
        return;
    }
    const context = canvas.value.getContext('2d');
    if (frame.mode === 'motion') {
        DrawSample(context, WIDTH, HEIGHT, frame.elapsed);
    } else {
        DrawModelSample(context, frame.elapsed);
    }
    if (channel.algorithm.showBox) {
        frame.detections.forEach(item => DrawDetection(context, item));
    }
}, { flush: 'post' });
watch(localFrame, frame => emit('local-frame', frame));
onMounted(() => {
    if (props.previewOnly && !browserSource.value) {
        DrawModelSample(canvas.value.getContext('2d'), 0);
    }
});
onBeforeUnmount(CloseLocal);
</script>
