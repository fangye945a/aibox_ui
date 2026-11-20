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
        <!-- 实时检测 -->
        <template v-if="tab === 'live'">
            <div v-if="selected" class="video-live-toolbar">
                <div class="video-channel-picker">
                    <label for="live-channel">视频通道</label>
                    <el-select id="live-channel" :model-value="selected.id" aria-label="视频通道" filterable @change="Open('live', $event)">
                        <el-option v-for="channel in workspace.channels" :key="channel.id" :label="channel.name" :value="channel.id" />
                    </el-select>
                </div>
                <div class="video-live-meta">
                    <el-tag :type="VideoStatusType(selected)" effect="light">{{ VideoChannelStatus(selected) }}</el-tag>
                    <span>分析帧率 <strong>{{ analysisFps }} FPS</strong></span>
                </div>
            </div>
            <div class="video-live">
                <VideoChannel v-if="selected" :key="selected.id" :channel="selected" :workspace="workspace"
                    @local-frame="localFrame = $event" @pause-preview="paused = $event"
                    @configure="Open('settings', selected.id)" @records="Open('records', selected.id)" @diagnose="Open('diagnostics', selected.id)" />
                <section v-else class="video-panel" aria-label="未配置通道">
                    <div class="video-picture"><div class="video-placeholder">暂无通道</div></div>
                    <el-button link type="primary" @click="Open('settings')">配置通道</el-button>
                </section>
                <aside v-if="selected" class="video-panel video-results" aria-label="选中画面分析">
                    <div class="video-heading">
                        <h2>检测结果</h2>
                        <span v-if="frame" class="video-result-count">{{ frame.detections.length }} 个结果 · 帧 #{{ frame.sequence }}</span>
                    </div>
                    <p v-if="!frame" class="video-muted">{{ frameHint }}</p>
                    <section v-for="model in modelResults" :key="model.id" class="video-model-result">
                        <div class="video-heading">
                            <h3>{{ model.name }}</h3>
                            <span class="video-result-count">{{ frame ? `${model.detections.length} 项` : '已启用' }}</span>
                        </div>
                        <div v-if="model.detections.length" class="video-tags">
                            <el-tag v-for="(item, index) in model.detections" :key="index" size="small" effect="plain">{{ DetectionText(item) }}</el-tag>
                        </div>
                        <p v-else-if="frame" class="video-muted">无符合阈值的结果</p>
                    </section>
                    <p v-if="frame && selected.algorithm.mode === 'motion'">画面变化 {{ frame.motion?.toFixed(1) ?? '—' }}%</p>
                    <p v-if="frame && selected.algorithm.mode === 'none'" class="video-muted">当前通道仅预览</p>
                    <details class="video-runtime-details">
                        <summary>运行详情</summary>
                        <dl class="video-fields">
                            <dt>源时间戳</dt><dd>{{ frame ? `${frame.elapsed} ms` : '—' }}</dd>
                            <dt>输入规格</dt><dd>{{ frame ? `${frame.inputWidth} × ${frame.inputHeight}` : '—' }}</dd>
                            <template v-if="selected.algorithm.mode === 'model'">
                                <dt>推理</dt><dd>{{ Timed('inference') }}</dd>
                                <dt>解码 / 预处理</dt><dd>{{ Timed('decode') }} / {{ Timed('preprocess') }}</dd>
                                <dt>后处理 / JPEG</dt><dd>{{ Timed('postprocess') }} / {{ Timed('jpeg') }}</dd>
                                <dt>管线耗时</dt><dd>{{ Timed('pipeline') }}</dd>
                            </template>
                        </dl>
                    </details>
                </aside>
            </div>
        </template>
        <VideoRecords v-else-if="tab === 'records'" :workspace="workspace" :initial-channel="routeChannel" />
        <VideoChannelList v-else-if="tab === 'settings'" :workspace="workspace" :initial-channel="routeChannel"
            @show-live="Open('live', $event)" />
        <VideoConfiguration v-else-if="tab === 'models'" :workspace="workspace" />
        <!-- 视频诊断 -->
        <template v-else-if="tab === 'diagnostics'">
            <el-radio-group :model-value="routeChannel" aria-label="诊断通道" @change="Open('diagnostics', $event)">
            <el-radio-button value="">全部通道</el-radio-button>
            <el-radio-button v-for="item in workspace.channels" :key="item.id" :value="item.id">{{ item.name }}</el-radio-button>
            </el-radio-group>
            <VideoPerformance :workspace="workspace" :channel-id="routeChannel" @show-live="Open('live', $event)" />
        </template>
    </section>
</template>

<script setup>
import { computed, inject, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import VideoChannel from '@/components/video/VideoChannel.vue';
import VideoRecords from '@/components/video/VideoRecords.vue';
import VideoConfiguration from '@/components/video/VideoConfiguration.vue';
import VideoChannelList from '@/components/video/VideoChannelList.vue';
import VideoPerformance from '@/components/video/VideoPerformance.vue';
import { DetectionText } from '@/demo/video-recognition';
import { ChannelModels, IsBrowserSource, VIDEO_WORKSPACE, VideoChannelStatus, VideoStatusType } from '@/demo/video-workspace';

const route = useRoute();
const router = useRouter();
const workspace = inject(VIDEO_WORKSPACE);
const routeChannel = computed(() => workspace.channels.some(channel => channel.id === route.query.channel) ? route.query.channel : '');
const tab = computed(() => ['records', 'settings', 'models', 'diagnostics'].includes(route.query.view) ? route.query.view : 'live');
const selected = computed(() => workspace.channels.find(channel => channel.id === routeChannel.value) ?? workspace.channels[0]);
const paused = ref(false);
const localFrame = ref(null);
const frame = computed(() => {
    if (!selected.value || paused.value) {
        return null;
    }
    return IsBrowserSource(selected.value.source) ? localFrame.value : selected.value.frame;
});
const frameHint = computed(() => paused.value ? '预览已暂停' : '等待分析画面');
const analysisFps = computed(() => {
    if (!selected.value || selected.value.algorithm.mode === 'none') {
        return 0;
    }
    return IsBrowserSource(selected.value.source) ? localFrame.value?.fps ?? 0 : selected.value.fps;
});
const modelResults = computed(() => {
    if (!selected.value) {
        return [];
    }
    return frame.value?.modelResults ?? ChannelModels(workspace, selected.value).map(model => ({ ...model, detections: [] }));
});

function Open(view, channel) {
    const query = view === 'live' ? {} : { view };
    if (channel) {
        query.channel = channel;
    }
    router.push({ name: 'videoRecognition', query });
}

function Timed(key) {
    const value = frame.value?.timings?.[key];
    return value == null ? '—' : `${value.toFixed(1)} ms`;
}

watch([tab, () => selected.value?.id], () => {
    localFrame.value = null;
    paused.value = false;
});
</script>

<style src="@/assets/css/video-workspace.css"></style>
