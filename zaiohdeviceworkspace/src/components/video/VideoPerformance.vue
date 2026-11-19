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
    <section v-if="!analysis" class="video-section video-divider" aria-label="板端专项指标">
        <div class="video-heading"><h2>板端专项指标</h2><span class="video-muted">RK3588（模拟） · {{ DateText(latest.timestamp) }}</span></div>
        <div class="video-metrics">
            <article v-for="metric in boardMetrics" :key="metric.id" class="video-panel">
                <div class="video-heading">
                    <h3>{{ metric.label }}</h3>
                    <el-tag size="small" :type="metric.value == null ? 'info' : 'success'">{{ metric.value == null ? '不可用' : '可用' }}</el-tag>
                </div>
                <p class="video-metric-value">{{ Value(metric.value, metric.unit === 'Mbps' ? 3 : 1) }} <small>{{ metric.unit }}</small></p>
                <dl class="video-fields">
                    <dt>来源</dt><dd>{{ metric.source }}</dd>
                    <dt>范围</dt><dd>{{ metric.scope }}</dd>
                    <dt>测量窗口</dt><dd>{{ MetricWindow(metric.window) }}</dd>
                </dl>
                <p v-if="metric.reason" class="video-muted">不可用原因：{{ metric.reason }}</p>
            </article>
        </div>
        <h2 class="video-divider">监测报警</h2>
        <el-alert v-if="warm" type="warning" title="模拟报警：芯片温度超过 73 °C" :closable="false" show-icon />
        <p v-else class="video-muted">本次模拟采样没有报警</p>
        <details class="video-divider">
            <summary>查看板端专项指标统计</summary>
            <el-form class="video-filter" label-position="top" @submit.prevent="ApplyWindow">
                <el-form-item label="窗口长度（秒）">
                    <el-input-number v-model="draft" aria-label="窗口长度（秒）" :min="10" :max="3600" :precision="0" />
                </el-form-item>
                <el-button type="primary" native-type="submit">应用窗口</el-button>
                <span class="video-muted">统计窗口 {{ applied }} 秒</span>
            </el-form>
            <el-table :data="boardStats" stripe>
                <el-table-column label="指标 / 单位" min-width="155"><template #default="{ row }">{{ row.label }} ({{ row.unit }})</template></el-table-column>
                <el-table-column v-for="stat in columns" :key="stat.key" :label="stat.label" min-width="75">
                    <template #default="{ row }">{{ Value(row[stat.key]) }}</template>
                </el-table-column>
                <el-table-column label="样本数" min-width="115">
                    <template #default="{ row }">{{ row.count }}<small v-if="row.unavailable"> · {{ row.unavailable }} 不可用</small></template>
                </el-table-column>
                <el-table-column label="有效覆盖" min-width="100">
                    <template #default="{ row }">{{ Value(row.coverage) }} 秒</template>
                </el-table-column>
            </el-table>
        </details>
    </section>
    <section v-else class="video-section" aria-label="通道诊断详情">
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

const props = defineProps({ workspace: Object, analysis: Boolean, channelId: String });
defineEmits(['show-live']);
const columns = [{ key: 'mean', label: '平均' }, { key: 'p95', label: 'p95' }, { key: 'min', label: '最小' }, { key: 'max', label: '最大' }];
const draft = ref(60);
const applied = ref(60);
const latest = computed(() => props.workspace.metrics.at(-1));
const boardMetrics = computed(() => latest.value.metrics.filter(metric => !['cpu', 'memory', 'ethRx', 'ethTx'].includes(metric.id)));
const warm = computed(() => latest.value.metrics.find(metric => metric.id === 'temperature').value > 73);
const cutoff = computed(() => latest.value.timestamp - applied.value * 1000);
const boardStats = computed(() => {
    const samples = props.workspace.metrics.filter(sample => sample.timestamp >= cutoff.value);
    return boardMetrics.value.map(metric => ({
        ...metric, ...SummarizeSamples(samples, sample => sample.metrics.find(item => item.id === metric.id)?.value)
    }));
});
const shownChannels = computed(() => props.workspace.channels.filter(channel => !props.channelId || channel.id === props.channelId));
const channelStats = computed(() => props.workspace.channels.map((channel, index) => {
    const list = props.workspace.timings[index].filter(sample => sample.timestamp >= cutoff.value);
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

function MetricWindow(value) {
    return value == null ? '未知' : value === 0 ? '瞬时（0 秒）' : `${value} 秒`;
}
</script>
