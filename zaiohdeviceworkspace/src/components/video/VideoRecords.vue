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
    <section class="video-section" aria-label="检测记录">
        <div class="video-heading">
            <h2>检索检测记录</h2>
            <el-radio-group v-model="view" aria-label="记录视图">
                <el-radio-button value="records">记录</el-radio-button>
                <el-radio-button value="statistics">统计</el-radio-button>
            </el-radio-group>
        </div>
        <el-form class="video-filter" label-position="top" @submit.prevent="ApplyFilters">
            <el-form-item label="通道">
                <el-select v-model="draft.channel" aria-label="通道">
                    <el-option label="全部通道" value="" />
                    <el-option v-for="channel in workspace.channels" :key="channel.id" :label="channel.name" :value="channel.id" />
                </el-select>
            </el-form-item>
            <el-form-item label="关键词">
                <el-input v-model="draft.query" aria-label="关键词" clearable placeholder="搜索检测记录" />
            </el-form-item>
            <el-form-item label="开始时间（本地）" for="video-filter-start">
                <input id="video-filter-start" v-model="draft.start" type="datetime-local" />
            </el-form-item>
            <el-form-item label="结束时间（本地）" for="video-filter-end">
                <input id="video-filter-end" v-model="draft.end" type="datetime-local" :min="draft.start || undefined" />
            </el-form-item>
            <div>
                <el-button type="primary" native-type="submit">{{ statistics ? '应用筛选' : '查询' }}</el-button>
                <el-button v-if="!statistics" :icon="Download" @click="Export">导出 CSV</el-button>
            </div>
        </el-form>
        <template v-if="!statistics">
            <h2 class="video-divider">检测记录 · {{ records.length }} 条</h2>
            <el-table :data="pageRows" row-key="id" stripe empty-text="没有符合条件的检测记录">
                <el-table-column label="记录 / 时间" min-width="190">
                    <template #default="{ row }">#{{ row.id }} · {{ DateText(row.createdAt) }}</template>
                </el-table-column>
                <el-table-column label="通道" min-width="140">
                    <template #default="{ row }">{{ row.channelName ?? ChannelName(row.channelId) }}<br><small>{{ row.modelId }}</small></template>
                </el-table-column>
                <el-table-column label="检测结果" min-width="200">
                    <template #default="{ row }">{{ ResultText(row) }}</template>
                </el-table-column>
                <el-table-column label="源尺寸" width="110">
                    <template #default="{ row }">{{ row.width }} × {{ row.height }}</template>
                </el-table-column>
                <el-table-column label="处理耗时" min-width="145">
                    <template #default="{ row }">{{ row.timings.pipeline.toFixed(1) }} ms<small> · 帧 #{{ row.sequence }}</small></template>
                </el-table-column>
                <el-table-column label="操作" width="105">
                    <template #default="{ row }"><el-button link type="primary" @click="Open(row)">历史截图</el-button></template>
                </el-table-column>
            </el-table>
            <el-pagination v-model:current-page="page" :page-size="PAGE_SIZE" :total="records.length" layout="prev, pager, next" />
            <el-dialog v-model="snapshotOpen" :title="`历史截图 · #${snapshot?.id ?? ''}`" width="min(700px, 94vw)" @opened="PaintSnapshot">
                <p v-if="snapshot" class="video-muted">
                    {{ DateText(snapshot.createdAt) }} · {{ snapshot.channelName ?? ChannelName(snapshot.channelId) }} · {{ snapshot.width }} × {{ snapshot.height }}
                </p>
                <canvas ref="snapshotCanvas" class="video-snapshot" :width="snapshot?.width" :height="snapshot?.height" aria-label="历史检测截图"></canvas>
                <template #footer>
                    <el-button type="primary" :icon="Download" :disabled="!snapshotReady" @click="SaveSnapshot">下载标注 PNG</el-button>
                </template>
            </el-dialog>
        </template>
        <template v-else>
            <p class="video-muted">采样观察量统计保留记录中的所有检测目标，包含重复出现的目标。</p>
            <dl class="video-summary">
                <div><dt>保存记录数</dt><dd>{{ records.length }}</dd></div>
                <div><dt>采样观察量</dt><dd>{{ observations }}</dd></div>
                <div><dt>统计范围</dt><dd>{{ applied.channel ? ChannelName(applied.channel) : '全部通道' }} · 浏览器模拟记录</dd></div>
            </dl>
            <div class="video-columns video-divider">
                <section>
                    <h2>类别观察量</h2>
                    <div v-for="row in categories" :key="row.kind" class="video-bar">
                        <span>{{ DetectionLabel(row.kind) }}</span>
                        <el-progress :percentage="row.count * 100 / (categories[0]?.count || 1)" :show-text="false" />
                        <strong>{{ row.count }}</strong>
                    </div>
                    <el-empty v-if="!categories.length" description="无观察量" :image-size="60" />
                </section>
                <section>
                    <h2>每小时采样观察量</h2>
                    <template v-if="hours.length">
                        <svg class="video-trend" viewBox="0 0 520 158" role="img" aria-label="每小时采样观察量趋势">
                            <text x="12" y="17" fill="#596b78">最大值 {{ peak }}</text>
                            <line x1="12" x2="508" y1="127" y2="127" stroke="#dcdfe6" />
                            <rect v-for="(row, index) in hours" :key="row.hour" :x="12 + index * barWidth" :y="127 - row.count / peak * 95"
                                :width="barWidth * 0.72" :height="row.count / peak * 95" fill="var(--el-color-primary)">
                                <title>{{ DateText(row.hour) }}：{{ row.count }}</title>
                            </rect>
                            <text x="12" y="150" fill="#596b78">{{ HourLabel(hours[0].hour) }}</text>
                            <text x="508" y="150" fill="#596b78" text-anchor="end">{{ HourLabel(hours.at(-1).hour) }}</text>
                        </svg>
                        <details>
                            <summary>查看完整时间与数值</summary>
                            <el-table :data="hours" max-height="330">
                                <el-table-column label="小时（本地）" min-width="150">
                                    <template #default="{ row }">{{ DateText(row.hour) }}</template>
                                </el-table-column>
                                <el-table-column label="观察量" prop="count" width="90" />
                            </el-table>
                        </details>
                    </template>
                    <el-empty v-else description="无时间趋势" :image-size="60" />
                </section>
            </div>
        </template>
    </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { Download } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { DateText, DetectionLabel, DownloadBlob, DrawDetection, DrawModelSample } from '@/demo/video-recognition';
import { FilterVideoRecords } from '@/demo/video-workspace';

const PAGE_SIZE = 50;
const EMPTY_FILTERS = { channel: '', query: '', start: '', end: '' };
const props = defineProps({ workspace: Object, initialChannel: String });
const draft = reactive({ ...EMPTY_FILTERS });
const applied = ref({ ...EMPTY_FILTERS });
const view = ref('records');
const statistics = computed(() => view.value === 'statistics');
const page = ref(1);
const records = computed(() => FilterVideoRecords(props.workspace, applied.value));
const pageRows = computed(() => records.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE));
const snapshot = ref(null);
const snapshotOpen = ref(false);
const snapshotCanvas = ref(null);
const snapshotReady = ref(false);
const observations = computed(() => records.value.reduce((sum, record) => sum + record.detections.length, 0));
const categories = computed(() => {
    const counts = new Map();
    for (const record of records.value) {
        for (const item of record.detections) {
            counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
        }
    }
    return Array.from(counts, ([kind, count]) => ({ kind, count })).sort((first, second) => second.count - first.count);
});
const hours = computed(() => {
    const counts = new Map();
    for (const record of records.value) {
        const hour = new Date(record.createdAt);
        hour.setMinutes(0, 0, 0);
        counts.set(+hour, (counts.get(+hour) ?? 0) + record.detections.length);
    }
    return Array.from(counts, ([hour, count]) => ({ hour, count })).sort((first, second) => first.hour - second.hour);
});
const peak = computed(() => Math.max(1, ...hours.value.map(row => row.count)));
const barWidth = computed(() => 496 / Math.max(1, hours.value.length));

function ChannelName(id) {
    return props.workspace.channels.find(channel => channel.id === id)?.name ?? id;
}

function HourLabel(timestamp) {
    return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function ApplyFilters() {
    if (draft.start && draft.end && draft.start > draft.end) {
        ElMessage.warning('结束时间不能早于开始时间');
        return;
    }
    applied.value = { ...draft };
    page.value = 1;
}

function ResultText(record) {
    return record.detections.map(item => `${DetectionLabel(item.kind)} ${Math.round(item.score * 100)}%`).join('、') || '无目标';
}

function CsvCell(value) {
    const text = String(value ?? '');
    const safe = /^\s*[=+\-@]|^[\t\r\n]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
}

function Export() {
    const rows = records.value.map(row => [row.id, DateText(row.createdAt), row.channelName ?? ChannelName(row.channelId), row.modelId,
        row.sequence, row.width, row.height, row.elapsed, ResultText(row), row.timings.pipeline.toFixed(1)]);
    rows.unshift(['记录', '时间', '通道', '模型', '帧号', '宽度', '高度', '源时间戳(ms)', '检测结果', '管线耗时(ms)']);
    DownloadBlob(new Blob(['\ufeff', rows.map(row => row.map(CsvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'traceiq-records.csv');
}

function Open(record) {
    snapshot.value = record;
    snapshotReady.value = false;
    snapshotOpen.value = true;
}

function PaintSnapshot() {
    const context = snapshotCanvas.value?.getContext('2d');
    if (!context || !snapshot.value) {
        return;
    }
    DrawModelSample(context, snapshot.value.elapsed);
    snapshot.value.detections.forEach(item => DrawDetection(context, item));
    snapshotReady.value = true;
}

function SaveSnapshot() {
    const id = snapshot.value.id;
    snapshotCanvas.value.toBlob(blob => {
        if (blob) {
            DownloadBlob(blob, `traceiq-record-${id}.png`);
        }
    }, 'image/png');
}

watch(() => records.value.length, count => {
    page.value = Math.min(page.value, Math.max(1, Math.ceil(count / PAGE_SIZE)));
});
watch(() => props.initialChannel, channel => {
    draft.channel = channel || '';
    applied.value = { ...applied.value, channel: draft.channel };
    page.value = 1;
}, { immediate: true });
</script>
