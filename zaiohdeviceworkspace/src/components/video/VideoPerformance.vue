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
    <section class="video-section" aria-label="通道诊断详情">
        <div class="video-columns">
            <article v-for="channel in shownChannels" :key="channel.id" class="video-panel" :aria-label="`${channel.name}诊断`">
                <div class="video-heading"><h2>{{ channel.name }}</h2><el-tag>{{ VideoChannelStatus(channel) }}</el-tag></div>
                <dl class="video-fields">
                    <dt>视频源</dt><dd>{{ VideoSourceName(workspace, channel.source) }}</dd>
                    <dt>推理速率</dt><dd>{{ channel.frame?.timings ? `${channel.fps} FPS` : '—' }}</dd>
                    <dt>重连次数</dt><dd>{{ channel.retries }}</dd>
                    <dt>最近故障</dt><dd>{{ channel.lastFailure || '暂无' }} <span v-if="channel.failedAt">· {{ DateText(channel.failedAt) }}</span></dd>
                </dl>
                <el-alert v-if="channel.error" :title="channel.error" type="error" :closable="false" show-icon />
                <div class="video-actions">
                    <el-button v-if="channel.state === 'running'" size="small" @click="SimulateFailure(channel)">模拟输入中断</el-button>
                    <el-button v-if="channel.state === 'error' && !IsBrowserSource(channel.source)" size="small" @click="StartVideoChannel(workspace, channel)">
                        重连检测
                    </el-button>
                    <el-button link type="primary" @click="$emit('show-live', channel.id)">返回实时检测</el-button>
                </div>
            </article>
        </div>
        <el-empty v-if="!shownChannels.length" description="暂无已配置通道" :image-size="65" />
        <h2 class="video-divider">分析窗口</h2>
        <el-form class="video-filter" label-position="top" @submit.prevent="ApplyWindow">
            <el-form-item label="窗口长度（秒）">
                <el-input-number v-model="draft" aria-label="窗口长度（秒）" :min="10" :max="3600" :precision="0" />
            </el-form-item>
            <el-button type="primary" native-type="submit">应用窗口</el-button>
        </el-form>
        <dl class="video-summary">
            <div><dt>请求分析窗口</dt><dd>{{ applied }} 秒</dd></div>
            <div><dt>样本覆盖</dt><dd>{{ Value(Math.max(0, ...channelStats.map(row => row.coverage))) }} 秒</dd></div>
            <div><dt>完成帧采样数</dt><dd>{{ channelStats.reduce((count, row) => count + row.count, 0) }}</dd></div>
        </dl>
        <h2 class="video-divider">通道推理耗时</h2>
        <p class="video-muted">以下耗时来自模拟完成帧；管线耗时不包含传输和浏览器显示延迟。</p>
        <el-table :data="channelStats" stripe>
            <el-table-column label="通道" prop="name" min-width="120" />
            <el-table-column label="完成帧样本数" prop="count" min-width="130" />
            <el-table-column label="有效覆盖" min-width="110"><template #default="{ row }">{{ Value(row.coverage) }} 秒</template></el-table-column>
            <el-table-column label="推理平均（ms）" min-width="135"><template #default="{ row }">{{ Value(row.mean) }}</template></el-table-column>
            <el-table-column label="推理 p95（ms）" min-width="135"><template #default="{ row }">{{ Value(row.p95) }}</template></el-table-column>
            <el-table-column label="推理最小 / 最大（ms）" min-width="155">
                <template #default="{ row }">{{ Value(row.min) }} / {{ Value(row.max) }}</template>
            </el-table-column>
            <el-table-column label="管线平均（ms）" min-width="135"><template #default="{ row }">{{ Value(row.pipeline) }}</template></el-table-column>
        </el-table>
    </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { DateText } from '@/demo/video-recognition';
import { FailVideoChannel, IsBrowserSource, StartVideoChannel, SummarizeSamples, VideoChannelStatus, VideoSourceName } from '@/demo/video-workspace';

const props = defineProps({ workspace: Object, channelId: String });
defineEmits(['show-live']);
const draft = ref(60);
const applied = ref(60);
const cutoff = computed(() => props.workspace.sampledAt - applied.value * 1000);
const shownChannels = computed(() => props.workspace.channels.filter(channel => !props.channelId || channel.id === props.channelId));
const channelStats = computed(() => props.workspace.channels.map(channel => {
    const list = (props.workspace.timings[channel.id] ?? []).filter(sample => sample.timestamp >= cutoff.value);
    return { id: channel.id, name: channel.name, ...SummarizeSamples(list, item => item.inference), pipeline: SummarizeSamples(list, item => item.pipeline).mean };
}).filter(row => !props.channelId || row.id === props.channelId));

function SimulateFailure(channel) {
    FailVideoChannel(channel, channel.source.type === 'rtsp' ? '模拟 RTSP 读取超时' : '模拟视频源暂时没有输出帧');
}

function ApplyWindow() {
    if (!Number.isInteger(draft.value) || draft.value < 10 || draft.value > 3600) {
        ElMessage.warning('请输入 10–3600 秒的分析窗口');
        return;
    }
    applied.value = draft.value;
}

function Value(value, digits = 1) {
    return value == null ? '—' : value.toFixed(digits);
}

</script>
