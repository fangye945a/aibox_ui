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
    <section class="recognition">
        <header class="video-heading recognition-header">
            <h1>视频分析</h1>
            <el-tag type="info" effect="plain">Mock 演示</el-tag>
        </header>
        <el-tabs v-model="tab" aria-label="视频分析页面">
            <el-tab-pane label="实时检测" name="live">
                <dl class="video-summary">
                    <div><dt>总处理速率（模拟）</dt><dd>{{ totalFps }} FPS</dd></div>
                    <div><dt>选中画面检测数</dt><dd>{{ frame?.detections.length ?? '—' }}</dd></div>
                    <div><dt>选中画面推理耗时</dt><dd>{{ Timed('inference') }}</dd></div>
                </dl>
                <div class="video-live">
                    <div class="video-columns">
                        <VideoChannel v-for="channel in workspace.channels" :key="channel.id" :channel="channel" :workspace="workspace"
                            :selected="channel.id === selectedId" @select="Select(channel.id)" />
                    </div>
                    <aside class="video-panel" aria-label="选中画面分析">
                        <div class="video-heading"><h2>{{ selected.name }}</h2><el-tag size="small">帧 #{{ frame?.sequence ?? '—' }}</el-tag></div>
                        <h3>当前帧目标分布</h3>
                        <div v-for="row in distribution" :key="row.kind" class="video-bar">
                            <span>{{ DetectionLabel(row.kind) }}</span>
                            <el-progress :percentage="row.count * 100 / frame.detections.length" :show-text="false" />
                            <strong>{{ row.count }}</strong>
                        </div>
                        <p v-if="!distribution.length" class="video-muted">{{ frame ? '当前帧无检测目标' : '暂无检测帧' }}</p>
                        <div class="video-tags" aria-label="当前帧置信度">
                            <el-tag v-for="(item, index) in frame?.detections ?? []" :key="index" size="small" type="info">
                                {{ DetectionLabel(item.kind) }}{{ item.score == null ? '' : ` ${Math.round(item.score * 100)}%` }}
                            </el-tag>
                        </div>
                        <dl class="video-fields">
                            <dt>模型</dt><dd>{{ frame?.modelId ?? '—' }}</dd>
                            <dt>源时间戳</dt><dd>{{ frame ? `${frame.elapsed} ms` : '—' }}</dd>
                            <dt>输入规格</dt><dd>{{ frame ? `${frame.inputWidth} × ${frame.inputHeight}` : '—' }}</dd>
                            <template v-if="selected.algorithm.mode === 'motion'"><dt>变化面积</dt><dd>{{ frame?.motion?.toFixed(1) ?? '—' }} %</dd></template>
                            <template v-else>
                                <dt>解码 / 预处理</dt><dd>{{ Timed('decode') }} / {{ Timed('preprocess') }}</dd>
                                <dt>后处理 / JPEG</dt><dd>{{ Timed('postprocess') }} / {{ Timed('jpeg') }}</dd>
                                <dt>管线耗时</dt><dd>{{ Timed('pipeline') }}</dd>
                            </template>
                        </dl>
                        <h3 class="video-divider">检测参数</h3>
                        <el-form class="video-form" label-position="top" @submit.prevent="SaveAlgorithm">
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
                                <el-form-item v-if="selected.id === 'person'" label="NMS IoU 阈值">
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
                            <div><el-button type="primary" native-type="submit" :disabled="unchanged">应用参数</el-button></div>
                        </el-form>
                    </aside>
                </div>
            </el-tab-pane>
            <el-tab-pane label="检测记录" name="records" lazy><VideoRecords :workspace="workspace" /></el-tab-pane>
            <el-tab-pane label="数据统计" name="statistics" lazy><VideoRecords :workspace="workspace" statistics /></el-tab-pane>
            <el-tab-pane label="模型管理" name="models" lazy><VideoConfiguration :workspace="workspace" models /></el-tab-pane>
            <el-tab-pane label="设备设置" name="settings" lazy><VideoConfiguration :workspace="workspace" /></el-tab-pane>
            <el-tab-pane label="性能监视" name="monitor" lazy><VideoPerformance :workspace="workspace" /></el-tab-pane>
            <el-tab-pane label="性能分析" name="performance" lazy><VideoPerformance :workspace="workspace" analysis /></el-tab-pane>
        </el-tabs>
    </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import VideoChannel from '@/components/video/VideoChannel.vue';
import VideoRecords from '@/components/video/VideoRecords.vue';
import VideoConfiguration from '@/components/video/VideoConfiguration.vue';
import VideoPerformance from '@/components/video/VideoPerformance.vue';
import { DetectionLabel } from '@/demo/video-recognition';
import { CreateVideoWorkspace, SamplePerformance, SaveVideoWorkspace } from '@/demo/video-workspace';

const workspace = CreateVideoWorkspace();
const tab = ref('live');
const selectedId = ref('person');
const selected = computed(() => workspace.channels.find(channel => channel.id === selectedId.value));
const algorithm = reactive({ ...selected.value.algorithm });
const unchanged = computed(() => JSON.stringify(algorithm) === JSON.stringify(selected.value.algorithm));
const frame = computed(() => selected.value.frame);
const totalFps = computed(() => workspace.channels.reduce((sum, channel) => sum + (channel.frame?.timings && channel.state === 'running' ? channel.fps : 0), 0));
const distribution = computed(() => {
    const counts = new Map();
    for (const item of frame.value?.detections ?? []) {
        counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
    }
    return Array.from(counts, ([kind, count]) => ({ kind, count }));
});
let timer = null;

function Select(id) {
    if (id !== selectedId.value) {
        selectedId.value = id;
        Object.assign(algorithm, selected.value.algorithm);
    }
}

function Timed(key) {
    const value = frame.value?.timings?.[key];
    return value == null ? '—' : `${value.toFixed(1)} ms`;
}

function SaveAlgorithm() {
    if (algorithm.mode === 'motion' && ![algorithm.sensitivity, algorithm.minArea, algorithm.interval].every(Number.isFinite)) {
        ElMessage.warning('请填写完整的画面变化检测参数');
        return;
    }
    selected.value.algorithm = { ...algorithm };
    SaveVideoWorkspace(workspace);
    ElMessage.success('检测参数已应用');
}

onMounted(() => {
    for (const channel of workspace.channels) {
        if (channel.autostart && !(channel.source.type === 'usb' && channel.source.realUsb)) {
            channel.state = 'starting';
            channel.session++;
        }
    }
    timer = setInterval(() => SamplePerformance(workspace), 2000);
});
onBeforeUnmount(() => clearInterval(timer));
</script>

<style>
.recognition { padding: 20px; background: #fff; border-radius: 8px; color: inherit; font-size: 14px; line-height: 1.5; min-width: 0; }
.recognition h1, .recognition h2, .recognition h3 { margin: 0; line-height: 1.4; }
.recognition h1 { font-size: 20px; }
.recognition h2 { font-size: 16px; }
.recognition h3 { font-size: 14px; }
.recognition-header { padding-bottom: 8px; }
.recognition .el-tabs__item { padding-inline: 13px; }
.recognition .el-table, .recognition .el-tabs__content, .recognition .el-form-item { min-width: 0; }
.recognition .el-table { width: 100%; }
.recognition .el-pagination { margin-top: 14px; }
.recognition .el-form-item { margin-bottom: 12px; }
.recognition input[type='file'] { max-width: 100%; }
.recognition input[type='datetime-local'] { padding: 4px 6px; border: 1px solid #dcdfe6; border-radius: 4px; color: inherit; background: #fff; }
.recognition .video-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.recognition .video-section { min-width: 0; }
.recognition .video-divider { border-top: 1px solid #e7ebef; margin: 18px 0 10px; padding-top: 14px; }
.recognition .video-columns, .recognition .video-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 12px; }
.recognition .video-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 12px; align-items: stretch; }
.recognition .video-live { display: grid; grid-template-columns: minmax(0, 1fr) minmax(250px, 290px); gap: 12px; }
.recognition .video-panel { padding: 12px; border: 1px solid #e1e7ed; border-radius: 6px; min-width: 0; overflow-wrap: anywhere; }
.recognition .video-panel h2 .el-button { padding-inline: 0; font-size: inherit; }
.recognition .video-selected { border-color: var(--el-color-primary); }
.recognition .video-picture { position: relative; aspect-ratio: 16 / 9; background: #17202a; border-radius: 4px; overflow: hidden; cursor: pointer; }
.recognition .video-picture:fullscreen { display: grid; place-items: center; border-radius: 0; }
.recognition .video-picture canvas { display: block; width: 100%; height: 100%; object-fit: contain; }
.recognition .video-placeholder { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 6px; background: #17202a; color: #d8e1e8; }
.recognition .video-fullscreen { position: absolute; right: 8px; bottom: 8px; }
.recognition .video-preview-info { padding: 8px 0 12px; font-size: 12px; color: #596b78; }
.recognition .video-muted, .recognition .video-note { color: #596b78; }
.recognition .video-note { display: block; margin-top: 4px; }
.recognition .video-form { margin-top: 6px; }
.recognition .video-form .el-select { width: 100%; }
.recognition .video-camera-options { display: flex; width: 100%; gap: 6px; }
.recognition .video-camera-options .el-select { flex: 1; min-width: 0; }
.recognition .video-form .el-slider { margin-inline: 6px; width: calc(100% - 12px); }
.recognition .video-form .el-slider__input { width: 65px; }
.recognition .video-filter { display: flex; align-items: end; flex-wrap: wrap; gap: 10px; margin: 10px 0; }
.recognition .video-filter .el-form-item { margin-bottom: 0; }
.recognition .video-filter .el-select { min-width: 130px; }
.recognition .video-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin: 0 0 12px;
    padding: 10px 12px;
    background: #f4f6f8;
    border-radius: 6px;
}
.recognition .video-summary dt { color: #596b78; font-size: 12px; }
.recognition .video-summary dd { margin: 4px 0 0; font-weight: 600; overflow-wrap: anywhere; }
.recognition .video-fields { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 8px; margin: 10px 0; font-size: 12px; }
.recognition .video-fields dt { color: #596b78; }
.recognition .video-fields dd { margin: 0; overflow-wrap: anywhere; }
.recognition .video-tags { display: flex; flex-wrap: wrap; gap: 5px; }
.recognition .video-bar { display: grid; grid-template-columns: minmax(42px, auto) minmax(0, 1fr) auto; align-items: center; gap: 10px; margin: 6px 0; font-size: 12px; }
.recognition .video-metric-value { margin: 7px 0; font-size: 23px; font-weight: 600; }
.recognition .video-metric-value small { font-size: 12px; font-weight: 400; }
.recognition .video-trend { display: block; width: 100%; max-width: 520px; }
.recognition .video-snapshot { display: block; width: 100%; height: auto; }
@media (max-width: 1180px) {
    .recognition .video-live { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 780px) {
    .recognition .video-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 620px) {
    .recognition { padding: 10px; }
    .recognition .video-columns, .recognition .video-metrics { grid-template-columns: minmax(0, 1fr); }
}
</style>
