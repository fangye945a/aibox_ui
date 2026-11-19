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
    <section class="video-section" :aria-label="`${channel.name}配置`">
        <div class="video-heading">
            <h2>{{ channel.name }} · 通道配置</h2>
            <el-tag size="small" type="info">{{ VideoChannelStatus(channel) }}</el-tag>
        </div>
        <el-form class="video-form" label-position="top" @submit.prevent="Save">
            <div class="video-columns">
                <section class="video-panel">
                    <h3>视频源</h3>
                    <el-form-item label="视频源类型">
                        <el-select v-model="draft.type" aria-label="视频源类型">
                            <el-option label="示例或本地 MP4" value="mp4" />
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
                        <el-checkbox v-if="draft.sourceId !== 'sample'" v-model="draft.loop">循环播放 MP4</el-checkbox>
                        <div class="video-actions">
                            <input ref="fileInput" type="file" accept=".mp4,video/mp4" aria-label="添加本地 MP4" @change="AddFile" />
                        </div>
                        <el-table v-if="workspace.sources.length > 1" :data="uploaded" size="small">
                            <el-table-column label="本地视频" prop="name" min-width="100" />
                            <el-table-column label="大小" width="90"><template #default="{ row }">{{ (row.size / 1048576).toFixed(2) }} MB</template></el-table-column>
                            <el-table-column label="添加时间" min-width="145">
                                <template #default="{ row }">{{ DateText(row.createdAt) }}</template>
                            </el-table-column>
                        </el-table>
                    </template>
                    <el-form-item v-else-if="draft.type === 'rtsp'" label="RTSP 流地址">
                        <el-input v-model.trim="draft.rtspUrl" aria-label="RTSP 流地址" placeholder="rtsp://camera.example:8554/stream" maxlength="2048" />
                    </el-form-item>
                    <template v-else>
                        <el-form-item v-if="!draft.realUsb" label="AIBox USB 摄像头编号（模拟）">
                            <el-input-number v-model="draft.cameraIndex" aria-label="AIBox USB 摄像头编号（模拟）" :min="0" :max="63" :precision="0" />
                        </el-form-item>
                        <el-checkbox v-model="draft.realUsb">使用浏览器本机摄像头（需要授权）</el-checkbox>
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
                    <el-button :disabled="busy" @click="VerifySource">验证画面</el-button>
                    <el-alert v-if="verification" :title="verification" :type="preview ? 'success' : 'error'" :closable="false" show-icon />
                    <VideoChannel v-if="preview" :key="previewKey" :channel="preview" :workspace="workspace" preview-only />
                </section>
                <section class="video-panel">
                    <h3>算法与模型</h3>
                    <el-form-item label="算法">
                        <el-select v-model="algorithm.mode" aria-label="算法">
                            <el-option label="模型检测（模拟）" value="model" />
                            <el-option label="画面变化检测" value="motion" />
                            <el-option label="仅预览" value="none" />
                        </el-select>
                    </el-form-item>
                    <template v-if="algorithm.mode === 'model'">
                        <el-form-item label="置信度阈值">
                            <el-slider v-model="algorithm.confidence" aria-label="置信度阈值" :min="0.01" :max="1" :step="0.01"
                                show-input :show-input-controls="false" />
                        </el-form-item>
                        <el-form-item v-if="channel.id === 'person'" label="NMS IoU 阈值">
                            <el-slider v-model="algorithm.nmsIou" aria-label="NMS IoU 阈值" :min="0.01" :max="1" :step="0.01" show-input :show-input-controls="false" />
                        </el-form-item>
                        <p v-else class="video-muted">NMS IoU：安全帽模型不适用</p>
                    </template>
                    <template v-else-if="algorithm.mode === 'motion'">
                        <el-form-item label="灵敏度"><el-slider v-model="algorithm.sensitivity" aria-label="灵敏度" :min="1" :max="100" /></el-form-item>
                        <el-form-item label="最小面积 (%)">
                            <el-input-number v-model="algorithm.minArea" :min="0.1" :max="100" :step="0.1" :precision="1" />
                        </el-form-item>
                        <el-form-item label="采样间隔 (ms)">
                            <el-input-number v-model="algorithm.interval" :min="100" :max="2000" :step="50" />
                        </el-form-item>
                    </template>
                    <el-checkbox v-if="algorithm.mode !== 'none'" v-model="algorithm.showBox">显示检测框</el-checkbox>
                    <el-form-item v-if="algorithm.mode === 'model'" label="绑定模型">
                        <el-select v-model="modelId" aria-label="绑定模型">
                            <el-option v-for="model in compatible" :key="model.id" :label="model.name" :value="model.id" />
                        </el-select>
                        <el-button link type="primary" @click="$emit('manage-models')">管理模型资产</el-button>
                    </el-form-item>
                    <h3 class="video-divider">运行设置</h3>
                    <el-form-item label="通道名称"><el-input v-model.trim="name" aria-label="通道名称" maxlength="80" required /></el-form-item>
                    <el-checkbox v-model="autostart" :disabled="IsBrowserSource(draft)">模拟 AIBox 启动时自动检测</el-checkbox>
                    <p v-if="IsBrowserSource(draft)" class="video-muted">此视频源由浏览器播放，可使用画面变化检测。</p>
                </section>
            </div>
            <div class="video-actions video-divider">
                <el-button type="primary" native-type="submit" :disabled="!changed || busy">保存通道配置</el-button>
                <el-button @click="$emit('show-live')">返回实时检测</el-button>
                <span v-if="running && taskChanged" class="video-muted">
                    {{ IsBrowserSource(draft) ? '切换到本地输入会停止该通道的模拟检测。' : `保存时仅重启 ${channel.name} 的检测任务。` }}
                </span>
            </div>
        </el-form>
    </section>
</template>

<script setup>
import { computed, reactive, ref, shallowRef, watch } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { DateText } from '@/demo/video-recognition';
import { AddVideoSource, IsBrowserSource, SaveVideoWorkspace, StartVideoChannel, StopVideoChannel, VideoChannelStatus, VideoSourceError } from '@/demo/video-workspace';
import VideoChannel from './VideoChannel.vue';

const RESOLUTIONS = ['640x480', '1280x720', '1920x1080'];
const FRAME_RATES = [15, 25, 30];
const props = defineProps({ channel: Object, workspace: Object });
const emit = defineEmits(['manage-models', 'show-live']);
const channel = props.channel;
const draft = reactive({ ...channel.source });
const algorithm = reactive({ ...channel.algorithm });
const name = ref(channel.name);
const autostart = ref(channel.autostart);
const modelId = ref(channel.modelId);
const devices = ref([]);
const fileInput = ref(null);
const preview = shallowRef(null);
const previewKey = ref(0);
const verification = ref('');
const busy = ref(false);
const savedDeviceMissing = computed(() => draft.deviceId && !devices.value.some(entry => entry.deviceId === draft.deviceId));
const uploaded = computed(() => props.workspace.sources.filter(item => item.file));
const running = computed(() => channel.state === 'running');
const compatible = computed(() => props.workspace.models.filter(model =>
    model.kind === channel.kind && model.target === 'rk3588' && model.status !== '已暂存'));
const taskChanged = computed(() => JSON.stringify(draft) !== JSON.stringify(channel.source) ||
    JSON.stringify(algorithm) !== JSON.stringify(channel.algorithm) || modelId.value !== channel.modelId);
const changed = computed(() => taskChanged.value || name.value !== channel.name || autostart.value !== channel.autostart);

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

function AddFile(event) {
    const file = event.target.files[0];
    if (!file?.size || !/\.mp4$/i.test(file.name)) {
        ElMessage.warning('请选择非空的 MP4 文件');
    } else {
        AddVideoSource(props.workspace, file);
        draft.sourceId = props.workspace.sources.at(-1).id;
        ElMessage.success('本地视频已添加');
    }
    fileInput.value.value = '';
}

function VerifySource() {
    const error = VideoSourceError(props.workspace, draft);
    preview.value = error ? null : { ...channel, source: { ...draft }, algorithm: { ...algorithm }, frame: null, error: '' };
    previewKey.value++;
    verification.value = error || (IsBrowserSource(draft) ? '可打开本地预览检查画面' : '模拟视频源已生成验证画面');
}

async function Save() {
    if (busy.value) {
        return;
    }
    const error = VideoSourceError(props.workspace, draft);
    const validParameters = algorithm.mode !== 'motion' || [algorithm.sensitivity, algorithm.minArea, algorithm.interval].every(Number.isFinite);
    if (error || !name.value || !compatible.value.some(model => model.id === modelId.value) || !validParameters) {
        ElMessage.warning(error || '请检查通道名称、模型和检测参数');
        return;
    }
    busy.value = true;
    try {
        const applyTaskChange = taskChanged.value;
        const restart = running.value && applyTaskChange;
        if (restart) {
            const message = IsBrowserSource(draft) ? `保存后将停止 ${channel.name} 的模拟任务，可在实时页打开本地预览。` :
                `保存时将短暂重启 ${channel.name}，另一通道继续运行。`;
            await ElMessageBox.confirm(message, '应用运行配置', { confirmButtonText: '保存并应用', cancelButtonText: '返回编辑' });
        }
        Object.assign(channel, { name: name.value, source: { ...draft }, algorithm: { ...algorithm }, modelId: modelId.value, autostart: autostart.value });
        SaveVideoWorkspace(props.workspace);
        if (restart && !IsBrowserSource(channel.source)) {
            StartVideoChannel(props.workspace, channel);
        } else if (applyTaskChange) {
            StopVideoChannel(channel);
        }
        preview.value = null;
        verification.value = '';
        ElMessage.success('通道配置已保存');
        emit('show-live');
    } catch (error) {
        if (error !== 'cancel' && error !== 'close') {
            ElMessage.error('无法保存通道配置');
        }
    } finally {
        busy.value = false;
    }
}

watch(draft, () => {
    preview.value = null;
    verification.value = '';
});
watch(() => draft.type === 'usb' && draft.realUsb, enabled => {
    if (enabled) {
        RefreshDevices();
    }
}, { immediate: true });
</script>
