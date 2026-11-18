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
    <section v-if="!analysis" class="video-section" aria-label="性能监视">
        <div class="video-heading"><h2>板端指标</h2><span class="video-muted">RK3588（模拟） · {{ DateText(latest.timestamp) }}</span></div>
        <div class="video-metrics">
            <article v-for="metric in latest.metrics" :key="metric.id" class="video-panel">
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
    </section>
    <section v-else class="video-section" aria-label="性能分析">
        <h2>分析窗口</h2>
        <el-form class="video-filter" label-position="top" @submit.prevent="ApplyWindow">
            <el-form-item label="窗口长度（秒）">
                <el-input-number v-model="draft" aria-label="窗口长度（秒）" :min="10" :max="3600" :precision="0" />
            </el-form-item>
            <el-button type="primary" native-type="submit">应用窗口</el-button>
        </el-form>
        <dl class="video-summary">
            <div><dt>请求分析窗口</dt><dd>{{ applied }} 秒</dd></div>
            <div><dt>样本覆盖</dt><dd>{{ Value(coverage) }} 秒</dd></div>
            <div><dt>指标采样数</dt><dd>{{ samples.length }}</dd></div>
        </dl>
        <h2 class="video-divider">设备指标统计</h2>
        <el-table :data="metricStats" stripe>
            <el-table-column label="指标 / 单位" min-width="160"><template #default="{ row }">{{ row.label }} ({{ row.unit }})</template></el-table-column>
            <el-table-column v-for="stat in columns" :key="stat.key" :label="stat.label" min-width="75">
                <template #default="{ row }">{{ Value(row[stat.key]) }}</template>
            </el-table-column>
            <el-table-column label="样本数" min-width="100">
                <template #default="{ row }">{{ row.count }}<small v-if="row.unavailable"> · {{ row.unavailable }} 不可用</small></template>
            </el-table-column>
            <el-table-column label="来源 / 范围" min-width="165">
                <template #default="{ row }">{{ row.source }}<br>{{ row.scope }}</template>
            </el-table-column>
            <el-table-column label="测量窗口 / 有效覆盖" min-width="165">
                <template #default="{ row }">{{ MetricWindow(row.window) }} / {{ Value(row.coverage) }} 秒</template>
            </el-table-column>
            <el-table-column label="统计状态 / 最新状态" min-width="160">
                <template #default="{ row }">{{ row.coverage >= applied - 3 ? '覆盖充分' : '覆盖不足' }}<br>{{ row.reason ?? '可用' }}</template>
            </el-table-column>
        </el-table>
        <h2 class="video-divider">通道推理耗时</h2>
        <p class="video-muted">以下耗时来自模拟完成帧；管线耗时不包含传输和浏览器显示延迟。</p>
        <el-table :data="channelStats" stripe>
            <el-table-column label="通道" prop="name" min-width="120" />
            <el-table-column label="完成帧样本数" prop="count" min-width="130" />
            <el-table-column label="有效覆盖" min-width="110"><template #default="{ row }">{{ Value(row.coverage) }} 秒</template></el-table-column>
            <el-table-column label="推理平均（ms）" min-width="135"><template #default="{ row }">{{ Value(row.mean) }}</template></el-table-column>
            <el-table-column label="推理 p95（ms）" min-width="135"><template #default="{ row }">{{ Value(row.p95) }}</template></el-table-column>
            <el-table-column label="管线平均（ms）" min-width="135"><template #default="{ row }">{{ Value(row.pipeline) }}</template></el-table-column>
        </el-table>
    </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { DateText } from '@/demo/video-recognition';
import { SummarizeSamples } from '@/demo/video-workspace';

const props = defineProps({ workspace: Object, analysis: Boolean });
const columns = [{ key: 'mean', label: '平均' }, { key: 'p95', label: 'p95' }, { key: 'min', label: '最小' }, { key: 'max', label: '最大' }];
const draft = ref(60);
const applied = ref(60);
const latest = computed(() => props.workspace.metrics.at(-1));
const warm = computed(() => latest.value.metrics.find(metric => metric.id === 'temperature').value > 73);
const cutoff = computed(() => latest.value.timestamp - applied.value * 1000);
const samples = computed(() => props.workspace.metrics.filter(sample => sample.timestamp >= cutoff.value));
const coverage = computed(() => (latest.value.timestamp - samples.value[0].timestamp) / 1000);
const metricStats = computed(() => latest.value.metrics.map((metric, index) => ({
    ...metric, ...SummarizeSamples(samples.value, sample => sample.metrics[index].value)
})));
const channelStats = computed(() => props.workspace.channels.map((channel, index) => {
    const list = props.workspace.timings[index].filter(sample => sample.timestamp >= cutoff.value);
    return { name: channel.name, ...SummarizeSamples(list, item => item.inference), pipeline: SummarizeSamples(list, item => item.pipeline).mean };
}));

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
