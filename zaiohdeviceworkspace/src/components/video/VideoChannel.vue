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
            <el-tag size="small" :type="statusType">{{ status }}</el-tag>
        </div>
        <div ref="picture" class="video-picture" @click="$emit('select')" @dblclick="Fullscreen">
            <canvas ref="canvas" :width="WIDTH" :height="HEIGHT" :aria-label="`${channel.name}实时画面`"></canvas>
            <video ref="video" muted playsinline hidden @ended="Complete" @error="VideoFailed"></video>
            <div v-if="channel.state !== 'running' && channel.state !== 'completed'" class="video-placeholder">
                <el-icon :size="28"><VideoCamera /></el-icon>
                {{ status }}
            </div>
            <el-button class="video-fullscreen" :icon="FullScreen" title="全屏" aria-label="全屏" circle size="small" @click.stop="Fullscreen" />
        </div>
        <div class="video-heading video-preview-info">
            <span>{{ sourceText }} · 预览 {{ channel.fps }} FPS</span>
            <el-button v-if="active || channel.state === 'completed' || channel.state === 'error'" :icon="VideoPause" size="small" @click="Stop">停止检测</el-button>
            <el-button v-else :icon="VideoPlay" size="small" type="primary" @click="Start">启动检测</el-button>
        </div>
        <el-alert v-if="channel.error" :title="channel.error" type="error" :closable="false" show-icon />
        <h3>视频源</h3>
        <el-form class="video-form" label-position="top" @submit.prevent="SaveSource">
            <el-form-item label="视频源类型">
                <el-select v-model="draft.type" aria-label="视频源类型">
                    <el-option label="本地 MP4 视频" value="mp4" />
                    <el-option label="RTSP 网络摄像头（模拟）" value="rtsp" />
                    <el-option v-if="channel.id === 'person'" label="USB 摄像头" value="usb" />
                </el-select>
            </el-form-item>
            <template v-if="draft.type === 'mp4'">
                <el-form-item label="MP4 视频源">
                    <el-select v-model="draft.sourceId" aria-label="MP4 视频源" placeholder="选择视频">
                        <el-option v-for="source in workspace.sources" :key="source.id" :label="source.name" :value="source.id" />
                    </el-select>
                </el-form-item>
                <el-checkbox v-model="draft.loop">循环播放 MP4</el-checkbox>
            </template>
            <el-form-item v-else-if="draft.type === 'rtsp'" label="RTSP 流地址">
                <el-input v-model.trim="draft.rtspUrl" aria-label="RTSP 流地址" placeholder="rtsp://camera.example:8554/stream" maxlength="2048" />
            </el-form-item>
            <template v-else>
                <el-form-item v-if="!draft.realUsb" label="USB 摄像头编号">
                    <el-input-number v-model="draft.cameraIndex" aria-label="USB 摄像头编号" :min="0" :max="63" :precision="0" />
                </el-form-item>
                <el-checkbox v-model="draft.realUsb">使用本机摄像头（需要授权）</el-checkbox>
                <template v-if="draft.realUsb">
                    <el-form-item label="本机摄像头">
                        <div class="video-camera-options">
                            <el-select v-model="draft.deviceId" aria-label="本机摄像头">
                                <el-option label="系统默认摄像头" value="" />
                                <el-option v-if="savedDeviceMissing" label="已保存的摄像头" :value="draft.deviceId" />
                                <el-option v-for="entry in devices" :key="entry.deviceId" :label="entry.label" :value="entry.deviceId" />
                            </el-select>
                            <el-button :icon="Refresh" title="刷新摄像头列表" aria-label="刷新摄像头列表" @click="RefreshDevices(true)" />
                        </div>
                    </el-form-item>
                    <el-form-item label="分辨率">
                        <el-select v-model="draft.resolution" aria-label="分辨率">
                            <el-option v-for="size in RESOLUTIONS" :key="size" :label="size.replace('x', ' × ')" :value="size" />
                        </el-select>
                    </el-form-item>
                    <el-form-item label="帧率（FPS）">
                        <el-select v-model="draft.fps" aria-label="帧率（FPS）">
                            <el-option v-for="rate in FRAME_RATES" :key="rate" :label="String(rate)" :value="rate" />
                        </el-select>
                    </el-form-item>
                </template>
            </template>
            <p v-if="liveMedia && channel.algorithm.mode === 'model'" class="video-muted">本地画面未运行模型，可切换到画面变化检测。</p>
            <div><el-button native-type="submit" :disabled="unchanged || channel.state === 'starting'">{{ active ? '应用视频源' : '保存视频源' }}</el-button></div>
        </el-form>
    </section>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { FullScreen, Refresh, VideoCamera, VideoPause, VideoPlay } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { CompareFrames, DrawSample, SAMPLE_HEIGHT, SAMPLE_WIDTH } from '@/utils/video-motion';
import { DrawDetection, DrawModelSample, IsDemoRtspAddress, ModelDetections } from '@/demo/video-recognition';
import { AddVideoRecord, FrameTimings, SaveVideoWorkspace } from '@/demo/video-workspace';

const WIDTH = 640;
const HEIGHT = 360;
const RECORD_INTERVAL = 12000;
const RESOLUTIONS = ['640x480', '1280x720', '1920x1080'];
const FRAME_RATES = [15, 25, 30];
const props = defineProps({ channel: Object, workspace: Object, selected: Boolean });
defineEmits(['select']);
const channel = props.channel;
const draft = reactive({ ...channel.source });
const canvas = ref(null);
const video = ref(null);
const picture = ref(null);
const devices = ref([]);
const savedDeviceMissing = computed(() => draft.deviceId && !devices.value.some(entry => entry.deviceId === draft.deviceId));
const liveMedia = computed(() => channel.source.type === 'usb' && channel.source.realUsb || channel.source.type === 'mp4' && channel.source.sourceId !== 'sample');
const active = computed(() => ['starting', 'running'].includes(channel.state));
const status = computed(() => ({ stopped: '已停止', starting: '启动中', running: '运行中', completed: '播放完成', error: '启动失败' })[channel.state]);
const statusType = computed(() => ({ running: 'success', starting: 'warning', error: 'danger' })[channel.state] ?? 'info');
const unchanged = computed(() => JSON.stringify(draft) === JSON.stringify(channel.source));
const sourceText = computed(() => {
    if (channel.source.type === 'mp4') {
        return props.workspace.sources.find(item => item.id === channel.source.sourceId)?.name ?? '视频文件不可用';
    }
    if (channel.source.type === 'rtsp') {
        return 'RTSP（模拟）';
    }
    return channel.source.realUsb ? 'USB（本机）' : `USB ${channel.source.cameraIndex}（模拟）`;
});

let stream = null;
let objectUrl = null;
let animation = 0;
let generation = 0;
let lastRecord = -Infinity;
let sequence = 0;

async function RefreshDevices(notify = false) {
    try {
        const entries = await navigator.mediaDevices.enumerateDevices();
        devices.value = entries.filter(entry => entry.kind === 'videoinput' && entry.deviceId).map((entry, index) => ({
            deviceId: entry.deviceId, label: entry.label || `摄像头 ${index + 1}`
        }));
        if (notify && !devices.value.length) {
            ElMessage.info('可先尝试系统默认摄像头');
        }
    } catch {
        if (notify) {
            ElMessage.warning('无法读取摄像头列表');
        }
    }
}

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
    channel.fps = 0;
}

function Stop() {
    channel.state = 'stopped';
    channel.error = '';
    channel.frame = null;
    Release();
}

function Complete() {
    if (channel.state === 'running') {
        channel.state = 'completed';
        Release();
    }
}

function Fail(message) {
    channel.state = 'error';
    channel.error = message;
    channel.frame = null;
    Release();
}

function VideoFailed() {
    if (active.value) {
        Fail('无法读取视频，请检查本地文件编码或重新选择视频源');
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
    if (timestamp - runtime.lastPaint < 64 || (runtime.media && !runtime.media.videoWidth)) {
        return;
    }
    const elapsed = Math.round(runtime.media ? runtime.media.currentTime * 1000 : timestamp - runtime.startedAt);
    const { mode, showBox } = channel.algorithm;
    if (runtime.mode !== mode) {
        Object.assign(runtime, { mode, pixels: null, motion: null, detections: [], lastMotion: -Infinity });
    }
    if (runtime.media) {
        PaintMedia(context, runtime.media);
    } else if (mode === 'motion') {
        DrawSample(context, WIDTH, HEIGHT, elapsed);
    } else {
        DrawModelSample(context, elapsed);
    }
    let detections = [];
    if (mode === 'motion') {
        detections = ReadMotion(context, timestamp, runtime);
    } else if (mode === 'model' && !runtime.media) {
        detections = ModelDetections(elapsed, { ...channel.algorithm, channelId: channel.id });
    }
    if (showBox) {
        detections.forEach(item => DrawDetection(context, item));
    }
    const timings = mode === 'model' && !runtime.media ? FrameTimings(channel.id, sequence) : null;
    const frame = { sequence: ++sequence, width: WIDTH, height: HEIGHT, elapsed, mode, detections, timings,
        inputWidth: runtime.media?.videoWidth ?? WIDTH, inputHeight: runtime.media?.videoHeight ?? HEIGHT,
        modelId: mode === 'model' ? channel.modelId : null, motion: runtime.motion };
    channel.frame = frame;
    if (runtime.frames++ === 0) {
        runtime.fpsStart = timestamp;
    }
    if (timestamp - runtime.fpsStart >= 1000) {
        channel.fps = Math.round(runtime.frames * 1000 / (timestamp - runtime.fpsStart));
        runtime.frames = 0;
    }
    runtime.lastPaint = timestamp;
    if (!runtime.media && mode === 'model' && detections.length && timestamp - lastRecord >= RECORD_INTERVAL) {
        lastRecord = timestamp;
        AddVideoRecord(props.workspace, channel, frame);
    }
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
        RefreshDevices();
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

async function Start() {
    Stop();
    const request = generation;
    channel.state = 'starting';
    try {
        const media = await OpenMedia(channel.source, request);
        if (request !== generation) {
            return;
        }
        await media?.play();
        if (request !== generation) {
            return;
        }
        const sample = document.createElement('canvas');
        sample.width = SAMPLE_WIDTH;
        sample.height = SAMPLE_HEIGHT;
        const runtime = { media, startedAt: performance.now(), lastPaint: -Infinity, lastMotion: -Infinity, frames: 0,
            mode: '', detections: [], sample: sample.getContext('2d', { willReadFrequently: true }) };
        const context = canvas.value.getContext('2d');
        channel.state = 'running';
        animation = requestAnimationFrame(timestamp => Render(context, timestamp, runtime));
    } catch (error) {
        if (request === generation) {
            Fail(error.name === 'NotAllowedError' ? '本机摄像头权限未开启' : error.message || '视频源启动失败');
        }
    }
}

function SaveSource() {
    if (draft.type === 'rtsp' && !IsDemoRtspAddress(draft.rtspUrl)) {
        ElMessage.warning('请输入不包含账号和密码的有效 RTSP 地址');
        return;
    }
    if (draft.type === 'usb' && !Number.isInteger(draft.cameraIndex)) {
        ElMessage.warning('请输入 0–63 的摄像头编号');
        return;
    }
    if (draft.type === 'mp4' && !props.workspace.sources.some(item => item.id === draft.sourceId)) {
        ElMessage.warning('请选择可用的 MP4 视频源');
        return;
    }
    channel.source = { ...draft };
    SaveVideoWorkspace(props.workspace);
    if (active.value) {
        Start();
    } else {
        Stop();
    }
    ElMessage.success('视频源已保存');
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

watch(() => channel.session, () => channel.state === 'starting' ? Start() : Stop());
watch(() => draft.type === 'usb' && draft.realUsb, enabled => {
    if (enabled) {
        RefreshDevices();
    }
}, { immediate: true });
onBeforeUnmount(Stop);
</script>
