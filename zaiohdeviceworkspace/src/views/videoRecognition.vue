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
            <header class="video-heading recognition-header">
                <h1>实时检测</h1>
                <el-tag type="info" effect="plain">Mock 演示</el-tag>
            </header>
                    <dl class="video-summary">
                        <div><dt>总处理速率（模拟）</dt><dd>{{ totalFps }} FPS</dd></div>
                        <div><dt>选中画面检测数</dt><dd>{{ frame?.detections.length ?? '—' }}</dd></div>
                        <div><dt>选中画面推理耗时</dt><dd>{{ Timed('inference') }}</dd></div>
                    </dl>
                    <div class="video-heading video-layout-toolbar">
                        <el-radio-group v-model="layout" aria-label="画面布局">
                            <el-radio-button :value="1">单通道</el-radio-button>
                            <el-radio-button :value="2">双通道</el-radio-button>
                            <el-radio-button :value="4">四通道</el-radio-button>
                        </el-radio-group>
                        <el-select v-if="layout < workspace.channels.length" v-model="pageIndex" aria-label="画面分组">
                            <el-option v-for="index in pageCount" :key="index" :label="GroupLabel(index - 1)" :value="index - 1" />
                        </el-select>
                    </div>
                    <div class="video-live">
                        <div class="video-grid" :class="`video-grid-${layout}`">
                            <VideoChannel v-for="channel in visibleChannels" :key="channel.id" :channel="channel" :workspace="workspace"
                                :selected="channel.id === selectedId" @select="selectedId = channel.id" @local-frame="UpdateLocal(channel.id, $event)"
                                @pause-preview="pausedPreviews[channel.id] = $event"
                                @configure="Open('settings', channel.id)" @records="Open('records', channel.id)" @diagnose="Open('diagnostics', channel.id)" />
                            <section v-for="index in emptySlots" :key="`empty-${index}`" class="video-panel" aria-label="未配置通道">
                                <div class="video-picture"><div class="video-placeholder">未配置</div></div>
                                <el-button link type="primary" @click="Open('settings')">配置通道</el-button>
                            </section>
                        </div>
                        <aside class="video-panel" aria-label="选中画面分析">
                            <div class="video-heading"><h2>{{ selected?.name || '画面详情' }}</h2><el-tag size="small">帧 #{{ frame?.sequence ?? '—' }}</el-tag></div>
                            <h3>当前帧目标分布</h3>
                            <div v-for="row in distribution" :key="row.kind" class="video-bar">
                                <span>{{ DetectionLabel(row.kind) }}</span>
                                <el-progress :percentage="row.count * 100 / frame.detections.length" :show-text="false" />
                                <strong>{{ row.count }}</strong>
                            </div>
                            <p v-if="!distribution.length" class="video-muted">{{ frameHint }}</p>
                            <div class="video-tags" aria-label="当前帧置信度">
                                <el-tag v-for="(item, index) in frame?.detections ?? []" :key="index" size="small" type="info">
                                    {{ DetectionLabel(item.kind) }}{{ item.score == null ? '' : ` ${Math.round(item.score * 100)}%` }}
                                </el-tag>
                            </div>
                            <dl class="video-fields">
                                <dt>模型</dt><dd>{{ frame?.modelId ?? '—' }}</dd>
                                <dt>源时间戳</dt><dd>{{ frame ? `${frame.elapsed} ms` : '—' }}</dd>
                                <dt>输入规格</dt><dd>{{ frame ? `${frame.inputWidth} × ${frame.inputHeight}` : '—' }}</dd>
                                <template v-if="selected?.algorithm.mode === 'motion'"><dt>变化面积</dt><dd>{{ frame?.motion?.toFixed(1) ?? '—' }} %</dd></template>
                                <template v-else>
                                    <dt>解码 / 预处理</dt><dd>{{ Timed('decode') }} / {{ Timed('preprocess') }}</dd>
                                    <dt>后处理 / JPEG</dt><dd>{{ Timed('postprocess') }} / {{ Timed('jpeg') }}</dd>
                                    <dt>管线耗时</dt><dd>{{ Timed('pipeline') }}</dd>
                                </template>
                            </dl>
                        </aside>
                    </div>
        </template>
        <VideoRecords v-else-if="tab === 'records'" :workspace="workspace" :initial-channel="routeChannel" />
        <VideoChannelList v-else-if="tab === 'settings'" :workspace="workspace" :initial-channel="routeChannel"
            @show-live="Open('live', $event)" />
        <VideoConfiguration v-else-if="tab === 'models'" :workspace="workspace" />
        <!-- 视频诊断 -->
        <template v-else-if="tab === 'diagnostics'">
            <header class="video-heading recognition-header">
                <h1>视频诊断</h1>
                <el-tag type="info" effect="plain">Mock 演示</el-tag>
            </header>
            <el-radio-group :model-value="routeChannel" aria-label="诊断通道" @change="Open('diagnostics', $event)">
            <el-radio-button value="">全部通道</el-radio-button>
            <el-radio-button v-for="item in workspace.channels" :key="item.id" :value="item.id">{{ item.name }}</el-radio-button>
            </el-radio-group>
            <VideoPerformance :workspace="workspace" :channel-id="routeChannel" @show-live="Open('live', $event)" />
        </template>
    </section>
</template>

<script setup>
import { computed, inject, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import VideoChannel from '@/components/video/VideoChannel.vue';
import VideoRecords from '@/components/video/VideoRecords.vue';
import VideoConfiguration from '@/components/video/VideoConfiguration.vue';
import VideoChannelList from '@/components/video/VideoChannelList.vue';
import VideoPerformance from '@/components/video/VideoPerformance.vue';
import { DetectionLabel } from '@/demo/video-recognition';
import { IsBrowserSource, VIDEO_WORKSPACE } from '@/demo/video-workspace';

const route = useRoute();
const router = useRouter();
const workspace = inject(VIDEO_WORKSPACE);
const routeChannel = computed(() => workspace.channels.some(channel => channel.id === route.query.channel) ? route.query.channel : '');
const tab = computed({
    get: () => ['records', 'settings', 'models', 'diagnostics'].includes(route.query.view) ? route.query.view : 'live',
    set: next => Open(next)
});
const selectedId = ref(routeChannel.value || workspace.channels[0]?.id);
const automaticLayout = computed(() => workspace.channels.length > 2 ? 4 : Math.max(1, workspace.channels.length));
const manualLayout = ref(null);
const pageIndex = ref(0);
const layout = computed({
    get: () => manualLayout.value ?? automaticLayout.value,
    set: value => {
        manualLayout.value = value;
        FocusChannel(selectedId.value);
    }
});
const pageCount = computed(() => Math.ceil(workspace.channels.length / layout.value));
const visibleChannels = computed(() => workspace.channels.slice(pageIndex.value * layout.value, (pageIndex.value + 1) * layout.value));
const emptySlots = computed(() => layout.value - visibleChannels.value.length);
const selected = computed(() => workspace.channels.find(channel => channel.id === selectedId.value));
const localFrames = reactive({});
const pausedPreviews = reactive({});
const frame = computed(() => {
    if (!selected.value) {
        return null;
    }
    if (IsBrowserSource(selected.value.source)) {
        return localFrames[selectedId.value];
    }
    return pausedPreviews[selectedId.value] ? null : selected.value.frame;
});
const frameHint = computed(() => {
    if (pausedPreviews[selectedId.value]) {
        return '选中通道的预览已暂停';
    }
    return frame.value ? '当前帧无检测目标' : '暂无检测帧';
});
const totalFps = computed(() => workspace.channels.reduce((sum, channel) => sum + (channel.frame?.timings ? channel.fps : 0), 0));
const distribution = computed(() => {
    const counts = new Map();
    for (const item of frame.value?.detections ?? []) {
        counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
    }
    return Array.from(counts, ([kind, count]) => ({ kind, count }));
});

function Open(view, channel) {
    const query = view === 'live' ? {} : { view };
    if (channel) {
        query.channel = channel;
    }
    router.push({ name: 'videoRecognition', query });
}

function FocusChannel(id) {
    const index = workspace.channels.findIndex(item => item.id === id);
    pageIndex.value = index < 0 ? 0 : Math.floor(index / layout.value);
}

function GroupLabel(index) {
    return workspace.channels.slice(index * layout.value, (index + 1) * layout.value).map(channel => channel.name).join(' / ');
}

function UpdateLocal(id, value) {
    localFrames[id] = value;
}

function Timed(key) {
    const value = frame.value?.timings?.[key];
    return value == null ? '—' : `${value.toFixed(1)} ms`;
}

watch([tab, routeChannel], ([view, channel]) => {
    if (channel) {
        selectedId.value = channel;
        if (view === 'live') {
            FocusChannel(channel);
        }
    }
    if (view !== 'live') {
        Object.keys(localFrames).forEach(id => { delete localFrames[id]; });
        Object.keys(pausedPreviews).forEach(id => { delete pausedPreviews[id]; });
    }
}, { immediate: true });
watch(visibleChannels, entries => {
    if (!entries.some(item => item.id === selectedId.value)) {
        selectedId.value = entries[0]?.id;
    }
});
watch(() => workspace.channels.length, () => {
    manualLayout.value = null;
    pageIndex.value = 0;
});
</script>

<style src="@/assets/css/video-workspace.css"></style>
