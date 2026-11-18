<!--
 Copyright (c) 2026 Hunan OpenValley Digital Industry Development Co., Ltd.
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software distributed under the License
 is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 either express or implied. See the License for the specific language governing permissions
 and limitations under the License.
-->
<template>
    <section class="recognition">
        <header class="page-header">
            <h1>视频识别</h1>
            <el-tag :type="running ? 'success' : 'info'">{{ status }}</el-tag>
        </header>

        <div class="recognition-layout">
            <section class="preview" aria-labelledby="preview-title">
                <div class="panel-header">
                    <h2 id="preview-title">画面预览</h2>
                    <div class="actions">
                        <el-button v-if="running || starting" :icon="VideoPause" @click="StopPreview">停止预览</el-button>
                        <el-button v-else type="primary" :icon="VideoPlay" @click="StartPreview">开始预览</el-button>
                    </div>
                </div>
                <div class="picture">
                    <canvas ref="canvas" :width="PREVIEW_WIDTH" :height="PREVIEW_HEIGHT" aria-label="视频预览"></canvas>
                    <video ref="video" muted playsinline hidden @ended="StopPreview"></video>
                    <div v-if="!running" class="placeholder">
                        <el-icon :size="32"><VideoCamera /></el-icon>
                        <span>{{ starting ? '正在打开摄像头' : '预览已停止' }}</span>
                    </div>
                </div>
                <el-alert v-if="previewError" :title="previewError" type="error" :closable="false" show-icon />
                <dl class="stats">
                    <div><dt>视频来源</dt><dd>{{ activeSource }}</dd></div>
                    <div><dt>输入规格</dt><dd>{{ inputFormat }}</dd></div>
                    <div><dt>检测结果</dt><dd>{{ resultLabel }}</dd></div>
                    <div v-if="algorithm.mode === 'motion'"><dt>变化面积</dt><dd>{{ running && changedPercent !== null ? `${changedPercent.toFixed(1)}%` : '—' }}</dd></div>
                    <div v-else><dt>模型</dt><dd>{{ algorithm.mode === 'model' ? channel.model : '—' }}</dd></div>
                </dl>
            </section>

            <section class="settings" aria-label="视频识别配置">
                <el-radio-group :model-value="channelId" aria-label="检测通道" @change="SelectChannel">
                    <el-radio-button v-for="item in channels" :key="item.id" :value="item.id">{{ item.name }}</el-radio-button>
                </el-radio-group>
                <el-tabs v-model="selectedTab">
                    <el-tab-pane name="camera" label="摄像头配置">
                        <el-form label-position="top" @submit.prevent="SaveCamera">
                            <el-form-item label="视频来源" for="recognition-source">
                                <el-select id="recognition-source" v-model="cameraDraft.source">
                                    <el-option label="示例画面" value="sample" />
                                    <el-option label="本地 MP4 视频" value="mp4" />
                                    <el-option label="RTSP 网络摄像头（模拟）" value="rtsp" />
                                    <el-option v-if="channelId === 'person'" label="本机 USB 摄像头" value="local" />
                                </el-select>
                            </el-form-item>
                            <template v-if="cameraDraft.source === 'mp4'">
                                <el-form-item label="MP4 文件" for="recognition-mp4">
                                    <input id="recognition-mp4" :key="channelId" class="file-input" type="file" accept="video/mp4,.mp4" @change="ChooseFile">
                                    <span v-if="fileName" class="file-name">{{ fileName }}</span>
                                </el-form-item>
                                <el-form-item label="循环播放" for="recognition-loop">
                                    <el-switch id="recognition-loop" v-model="cameraDraft.loop" aria-label="循环播放" />
                                </el-form-item>
                            </template>
                            <el-form-item v-if="cameraDraft.source === 'rtsp'" label="RTSP 流地址" for="recognition-rtsp">
                                <el-input id="recognition-rtsp" v-model.trim="cameraDraft.rtspUrl" placeholder="rtsp://camera.example:8554/stream" maxlength="2048" />
                            </el-form-item>
                            <template v-if="cameraDraft.source === 'local'">
                                <el-form-item label="摄像头" for="recognition-device">
                                    <div class="device-row">
                                        <el-select id="recognition-device" v-model="cameraDraft.deviceId">
                                            <el-option label="系统默认摄像头" value="" />
                                            <el-option v-if="unknownCamera" label="已保存的摄像头" :value="cameraDraft.deviceId" />
                                            <el-option v-for="device in devices" :key="device.deviceId" :value="device.deviceId" :label="device.label" />
                                        </el-select>
                                        <el-tooltip content="刷新摄像头列表" placement="top">
                                            <el-button :icon="Refresh" aria-label="刷新摄像头列表" @click="RefreshDevices(true)" />
                                        </el-tooltip>
                                    </div>
                                </el-form-item>
                                <el-form-item label="分辨率" for="recognition-resolution">
                                    <el-select id="recognition-resolution" v-model="cameraDraft.resolution">
                                        <el-option v-for="size in resolutions" :key="size" :value="size" :label="size.replace('x', ' × ')" />
                                    </el-select>
                                </el-form-item>
                                <el-form-item label="帧率（FPS）" for="recognition-fps">
                                    <el-select id="recognition-fps" v-model="cameraDraft.fps">
                                        <el-option v-for="rate in frameRates" :key="rate" :value="rate" :label="String(rate)" />
                                    </el-select>
                                </el-form-item>
                            </template>
                            <el-button type="primary" native-type="submit">应用摄像头配置</el-button>
                        </el-form>
                    </el-tab-pane>

                    <el-tab-pane name="algorithm" label="算法配置">
                        <el-form label-position="top" @submit.prevent="SaveAlgorithm">
                            <el-form-item label="检测算法" for="recognition-algorithm">
                                <el-select id="recognition-algorithm" v-model="algorithmDraft.mode">
                                    <el-option :label="`${channel.model}（模拟）`" value="model" />
                                    <el-option label="画面变化检测" value="motion" />
                                    <el-option label="仅预览" value="none" />
                                </el-select>
                            </el-form-item>
                            <template v-if="algorithmDraft.mode === 'model'">
                                <el-form-item label="置信度阈值" for="recognition-confidence">
                                    <el-input-number id="recognition-confidence" v-model="algorithmDraft.confidence" :min="0.01" :max="1" :step="0.01" :precision="2" />
                                </el-form-item>
                                <el-form-item v-if="channelId === 'person'" label="NMS IoU 阈值" for="recognition-nms">
                                    <el-input-number id="recognition-nms" v-model="algorithmDraft.nmsIou" :min="0.01" :max="1" :step="0.01" :precision="2" />
                                </el-form-item>
                            </template>
                            <template v-if="algorithmDraft.mode === 'motion'">
                                <el-form-item label="像素变化灵敏度（1–100）" for="recognition-sensitivity">
                                    <el-input-number id="recognition-sensitivity" v-model="algorithmDraft.sensitivity" :min="1" :max="100" :step="1" step-strictly />
                                </el-form-item>
                                <el-form-item label="最小变化面积（%）" for="recognition-area">
                                    <el-input-number id="recognition-area" v-model="algorithmDraft.minArea" :min="0.1" :max="100" :step="0.1" :precision="1" />
                                </el-form-item>
                                <el-form-item label="采样间隔（毫秒）" for="recognition-interval">
                                    <el-input-number id="recognition-interval" v-model="algorithmDraft.interval" :min="100" :max="2000" :step="50" step-strictly />
                                </el-form-item>
                            </template>
                            <el-form-item v-if="algorithmDraft.mode !== 'none'" label="显示检测框" for="recognition-overlay">
                                <el-switch id="recognition-overlay" v-model="algorithmDraft.showBox" aria-label="显示检测框" />
                            </el-form-item>
                            <el-button type="primary" native-type="submit">应用算法配置</el-button>
                        </el-form>
                    </el-tab-pane>
                </el-tabs>
            </section>
        </div>
    </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { Refresh, VideoCamera, VideoPause, VideoPlay } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { storage } from '@/demo/storage';
import { CompareFrames, DrawSample, SAMPLE_HEIGHT, SAMPLE_WIDTH } from '@/utils/video-motion';
import { DrawModelSample, IsDemoRtspAddress } from '@/demo/video-recognition';

const PREVIEW_WIDTH = 640;
const PREVIEW_HEIGHT = 360;
const CAMERA_KEY = 'video-camera';
const ALGORITHM_KEY = 'video-algorithm';
const channels = [{ id: 'person', name: '人员检测', model: 'Person' }, { id: 'safety', name: '安全检测', model: 'YOLO26n' }];
const resolutions = ['640x480', '1280x720', '1920x1080'];
const frameRates = [15, 25, 30];
const defaultCamera = { source: 'sample', deviceId: '', resolution: '1280x720', fps: 25, loop: true, rtspUrl: '' };
const defaultAlgorithm = { mode: 'model', confidence: 0.25, nmsIou: 0.45, sensitivity: 60, minArea: 0.8, interval: 250, showBox: true };
const channelId = ref('person');
const channel = computed(() => channels.find(item => item.id === channelId.value));
const ChannelKey = key => channelId.value === 'person' ? key : `${key}:${channelId.value}`;
const files = new Map();
const fileName = ref('');

function ReadConfig(key, defaults) {
    try {
        return { ...defaults, ...JSON.parse(storage.getItem(key)) };
    } catch {
        return { ...defaults };
    }
}

const camera = ref(ReadConfig(CAMERA_KEY, defaultCamera));
const algorithm = ref(ReadConfig(ALGORITHM_KEY, defaultAlgorithm));
const cameraDraft = reactive({ ...camera.value });
const algorithmDraft = reactive({ ...algorithm.value });
const devices = ref([]);
const selectedTab = ref('camera');
const canvas = ref(null);
const video = ref(null);
const starting = ref(false);
const running = ref(false);
const changedPercent = ref(null);
const detected = ref(false);
const previewError = ref('');
const inputFormat = ref('—');
const detections = ref(null);
const activeSource = computed(() => ({local: '本机 USB 摄像头', mp4: '本地 MP4 视频', rtsp: 'RTSP（模拟）', sample: '示例画面'})[camera.value.source]);
const status = computed(() => running.value ? '预览中' : starting.value ? '连接中' : '已停止');
const resultLabel = computed(() => {
    if (!running.value || algorithm.value.mode === 'none') {
        return '—';
    }
    if (algorithm.value.mode === 'model') {
        if (detections.value === null) {
            return '模型仅在示例中演示';
        }
        const { person, hat } = detections.value;
        return channelId.value === 'person' ? `${person} 人员（模拟）` : `${person} 人员 / ${hat} 安全帽（模拟）`;
    }
    if (changedPercent.value === null) {
        return '等待采样';
    }
    return detected.value ? '检测到变化' : '无明显变化';
});
const unknownCamera = computed(() => cameraDraft.deviceId && !devices.value.some(device => device.deviceId === cameraDraft.deviceId));

let stream = null;
let fileUrl = '';
let previewId = 0;
let frameId = 0;
let startedAt = 0;
let lastPaint = -Infinity;
let lastSample = -Infinity;
let previousPixels = null;
let changedRegion = null;
let previewContext = null;
let sampleContext = null;

/** @brief 刷新浏览器可见的摄像头列表，不主动请求访问权限。 */
async function RefreshDevices(notify = false) {
    if (!navigator.mediaDevices?.enumerateDevices) {
        if (notify) {
            ElMessage.warning('当前环境无法读取摄像头列表，请使用 HTTPS 或本机地址');
        }
        return;
    }
    try {
        const entries = await navigator.mediaDevices.enumerateDevices();
        devices.value = entries.filter(device => device.kind === 'videoinput' && device.deviceId)
            .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `摄像头 ${index + 1}` }));
        if (notify && !devices.value.length) {
            ElMessage.info('未找到可选摄像头，可先尝试预览系统默认摄像头');
        }
    } catch {
        if (notify) {
            ElMessage.warning('无法读取摄像头列表');
        }
    }
}

function ResetDetection() {
    lastSample = -Infinity;
    previousPixels = null;
    changedRegion = null;
    changedPercent.value = null;
    detected.value = false;
    detections.value = null;
}

function DrawPreview(timestamp) {
    if (!running.value) {
        return;
    }
    frameId = requestAnimationFrame(DrawPreview);
    if (timestamp - lastPaint < 32) {
        return;
    }
    const cameraVideo = video.value;
    if (camera.value.source === 'local' || camera.value.source === 'mp4') {
        if (cameraVideo.readyState < 2 || !cameraVideo.videoWidth) {
            return;
        }
        const scale = Math.min(PREVIEW_WIDTH / cameraVideo.videoWidth, PREVIEW_HEIGHT / cameraVideo.videoHeight);
        const width = cameraVideo.videoWidth * scale;
        const height = cameraVideo.videoHeight * scale;
        previewContext.fillStyle = '#17202a';
        previewContext.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
        previewContext.drawImage(cameraVideo, (PREVIEW_WIDTH - width) / 2, (PREVIEW_HEIGHT - height) / 2, width, height);
    } else if (algorithm.value.mode === 'model') {
        const { confidence, nmsIou, showBox } = algorithm.value;
        const result = DrawModelSample(previewContext, timestamp - startedAt, { confidence, nmsIou, showBox, channelId: channelId.value });
        if (result.person !== detections.value?.person || result.hat !== detections.value?.hat) {
            detections.value = result;
        }
    } else {
        DrawSample(previewContext, PREVIEW_WIDTH, PREVIEW_HEIGHT, timestamp - startedAt);
    }
    lastPaint = timestamp;
    if (algorithm.value.mode !== 'motion') {
        return;
    }
    if (timestamp - lastSample >= algorithm.value.interval) {
        sampleContext.drawImage(canvas.value, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
        const pixels = sampleContext.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data;
        if (previousPixels) {
            const change = CompareFrames(previousPixels, pixels, algorithm.value.sensitivity);
            changedPercent.value = change?.percent ?? 0;
            changedRegion = change && change.percent >= algorithm.value.minArea ? change : null;
            detected.value = Boolean(changedRegion);
        }
        previousPixels = pixels;
        lastSample = timestamp;
    }
    if (changedRegion && algorithm.value.showBox) {
        previewContext.strokeStyle = '#61e2a6';
        previewContext.lineWidth = 2;
        previewContext.strokeRect(changedRegion.x * PREVIEW_WIDTH, changedRegion.y * PREVIEW_HEIGHT,
            changedRegion.width * PREVIEW_WIDTH, changedRegion.height * PREVIEW_HEIGHT);
    }
}

/** @brief 停止采样并释放当前摄像头；迟到的授权结果由启动流程释放。 */
function StopPreview() {
    previewId++;
    cancelAnimationFrame(frameId);
    running.value = false;
    starting.value = false;
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    if (video.value) {
        video.value.pause();
        video.value.srcObject = null;
        if (fileUrl) {
            video.value.removeAttribute('src');
            video.value.load();
        }
    }
    if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
        fileUrl = '';
    }
    ResetDetection();
    previewContext?.clearRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
    inputFormat.value = '—';
}

/** @brief 打开所选视频来源并启动预览；仅在选择本机摄像头时请求授权。 */
async function StartPreview() {
    if (running.value || starting.value) {
        return;
    }
    previewError.value = '';
    const id = ++previewId;
    starting.value = true;
    try {
        if (camera.value.source === 'local') {
            if (!navigator.mediaDevices?.getUserMedia) {
                previewError.value = '摄像头仅支持 HTTPS 或本机地址';
                return;
            }
            const [width, height] = camera.value.resolution.split('x').map(Number);
            const constraints = { width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: camera.value.fps } };
            if (camera.value.deviceId) {
                constraints.deviceId = { exact: camera.value.deviceId };
            }
            const media = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
            if (id !== previewId) {
                media.getTracks().forEach(track => track.stop());
                return;
            }
            stream = media;
            video.value.srcObject = media;
            await video.value.play();
            if (id !== previewId) {
                return;
            }
            const track = media.getVideoTracks()[0];
            const settings = track.getSettings();
            inputFormat.value = `${video.value.videoWidth} × ${video.value.videoHeight}` + (settings.frameRate ? ` · ${Math.round(settings.frameRate)} FPS` : '');
            track.addEventListener('ended', () => {
                if (id === previewId) {
                    StopPreview();
                    previewError.value = '摄像头已断开';
                }
            }, { once: true });
            RefreshDevices();
        } else if (camera.value.source === 'mp4') {
            const file = files.get(channelId.value);
            if (!file) {
                previewError.value = '请选择本地 MP4 文件';
                return;
            }
            fileUrl = URL.createObjectURL(file);
            video.value.loop = camera.value.loop;
            video.value.src = fileUrl;
            await video.value.play();
            if (id !== previewId) {
                return;
            }
            inputFormat.value = `${video.value.videoWidth} × ${video.value.videoHeight}`;
        } else {
            inputFormat.value = `${PREVIEW_WIDTH} × ${PREVIEW_HEIGHT}`;
        }
        startedAt = performance.now();
        lastPaint = -Infinity;
        running.value = true;
        frameId = requestAnimationFrame(DrawPreview);
    } catch (error) {
        if (id === previewId) {
            StopPreview();
            if (camera.value.source === 'mp4') {
                previewError.value = '无法播放此 MP4，请检查文件和视频编码';
            } else if (error.name === 'NotAllowedError') {
                previewError.value = '摄像头访问未获授权';
            } else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
                previewError.value = '找不到所选摄像头';
            } else {
                previewError.value = '无法打开摄像头，请检查设备是否已被占用';
            }
        }
    } finally {
        if (id === previewId) {
            starting.value = false;
        }
    }
}

function SaveCamera() {
    if (cameraDraft.source === 'rtsp' && !IsDemoRtspAddress(cameraDraft.rtspUrl)) {
        ElMessage.warning('请输入有效的 RTSP 地址，演示配置无需账号和密码');
        return;
    }
    StopPreview();
    previewError.value = '';
    camera.value = { ...cameraDraft };
    storage.setItem(ChannelKey(CAMERA_KEY), JSON.stringify(camera.value));
    ElMessage.success('摄像头配置已保存');
    if (['sample', 'rtsp'].includes(camera.value.source)) {
        StartPreview();
    }
}

function SaveAlgorithm() {
    if (algorithmDraft.mode === 'motion' && (!Number.isFinite(algorithmDraft.sensitivity) ||
        !Number.isFinite(algorithmDraft.minArea) || !Number.isFinite(algorithmDraft.interval))) {
        ElMessage.warning('请填写完整的检测参数');
        return;
    }
    if (algorithmDraft.mode === 'model' && (!Number.isFinite(algorithmDraft.confidence) ||
        (channelId.value === 'person' && !Number.isFinite(algorithmDraft.nmsIou)))) {
        ElMessage.warning('请填写完整的模型阈值');
        return;
    }
    algorithm.value = { ...algorithmDraft };
    storage.setItem(ChannelKey(ALGORITHM_KEY), JSON.stringify(algorithm.value));
    ResetDetection();
    ElMessage.success('算法配置已保存');
}

function ChooseFile(event) {
    const file = event.target.files?.[0];
    if (!file) {
        return;
    }
    if (!file.size || !file.name.toLowerCase().endsWith('.mp4')) {
        ElMessage.warning('请选择非空的 MP4 文件');
        event.target.value = '';
        return;
    }
    if (camera.value.source === 'mp4') {
        StopPreview();
    }
    files.set(channelId.value, file);
    fileName.value = file.name;
}

function SelectChannel(next) {
    if (next === channelId.value || !channels.some(item => item.id === next)) {
        return;
    }
    StopPreview();
    previewError.value = '';
    channelId.value = next;
    camera.value = ReadConfig(ChannelKey(CAMERA_KEY), defaultCamera);
    algorithm.value = ReadConfig(ChannelKey(ALGORITHM_KEY), defaultAlgorithm);
    Object.assign(cameraDraft, camera.value);
    Object.assign(algorithmDraft, algorithm.value);
    fileName.value = files.get(next)?.name ?? '';
    if (['sample', 'rtsp'].includes(camera.value.source)) {
        StartPreview();
    }
}

watch(() => cameraDraft.source, source => {
    if (source === 'local') {
        RefreshDevices();
    }
});

onMounted(() => {
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = SAMPLE_WIDTH;
    sampleCanvas.height = SAMPLE_HEIGHT;
    previewContext = canvas.value.getContext('2d');
    sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (['sample', 'rtsp'].includes(camera.value.source)) {
        StartPreview();
    } else {
        RefreshDevices();
    }
});

onBeforeUnmount(StopPreview);
</script>

<style scoped>
.recognition { padding: 20px; background: #fff; border-radius: 8px; font-size: 14px; color: #263744; }
.page-header, .panel-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.page-header { margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid #e7ebef; }
.page-header h1 { margin: 0; font-size: 20px; }
.panel-header { margin-bottom: 10px; }
.panel-header h2 { margin: 0; font-size: 16px; }
.recognition-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(250px, 290px); gap: 22px; }
.preview, .settings { min-width: 0; }
.picture { position: relative; aspect-ratio: 16 / 9; background: #17202a; border-radius: 6px; overflow: hidden; }
.picture canvas { display: block; width: 100%; height: 100%; }
.placeholder { position: absolute; inset: 0; display: flex; gap: 8px; flex-direction: column; align-items: center; justify-content: center; color: #d8e1e8; }
.preview :deep(.el-alert) { margin-top: 10px; }
.stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 12px 0 0; padding: 12px; background: #f4f6f8; border-radius: 6px; }
.stats dt { color: #596b78; font-size: 12px; }
.stats dd { margin: 5px 0 0; font-weight: 600; overflow-wrap: anywhere; min-height: 1.4em; }
.settings { padding-left: 16px; border-left: 1px solid #e7ebef; }
.settings :deep(.el-select) { width: 100%; }
.device-row { display: flex; align-items: center; gap: 6px; min-width: 0; width: 100%; }
.device-row :deep(.el-select) { min-width: 0; }
.file-input { width: 100%; }
.file-name { color: #596b78; overflow-wrap: anywhere; }
@media (max-width: 1050px) {
    .recognition-layout { grid-template-columns: minmax(0, 1fr); }
    .settings { padding-left: 0; border-left: 0; border-top: 1px solid #e7ebef; }
}
@media (max-width: 620px) {
    .recognition { padding: 10px; }
    .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
