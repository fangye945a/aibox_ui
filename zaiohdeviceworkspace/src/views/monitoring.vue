<template>
    <section class="recognition monitoring-container">
        <div class="video-heading recognition-header">
            <h1>整机状态</h1>
            <el-tag type="info" effect="plain">Mock 演示</el-tag>
        </div>
        <div class="monitor-alert-summary" :class="{ 'has-alerts': latestAlert }">
            <el-icon :size="21"><Bell /></el-icon>
            <div class="monitor-alert-copy">
                <h2>系统告警 <span>{{ monitor.records.length }} 条</span></h2>
                <p v-if="latestAlert">最近一条：{{ latestAlert.type }} · {{ DateText(latestAlert.timestamp) }}</p>
                <p v-else>暂无系统告警</p>
            </div>
            <el-button link type="primary" @click="ShowAlerts">查看告警记录</el-button>
        </div>
        <el-tabs v-model="activeTab">
            <el-tab-pane v-for="metric in metrics" :key="metric.type" :label="metric.title" :name="metric.type" />
        </el-tabs>
        <MonitorChartPanel :key="`${activeTab}-${refreshKey}`" :indicator-type="selected.type" :title="selected.title"
            :color="selected.color" :unit="selected.unit" :percent="selected.percent || false" :companion="companion" />
        <div ref="alertSection" class="video-heading video-divider monitor-alert-records" tabindex="-1" aria-labelledby="system-alert-title">
            <h2 id="system-alert-title">系统告警记录 <small>{{ monitor.records.length }} 条</small></h2>
            <div class="video-actions">
                <el-button size="small" @click="Simulate">模拟指标超限</el-button>
                <el-button size="small" type="danger" plain :disabled="!monitor.records.length" @click="Clear">清除告警</el-button>
            </div>
        </div>
        <el-alert v-if="monitor.storageError" :title="monitor.storageError" type="warning" :closable="false" />
        <el-table :data="monitor.records" row-key="id" empty-text="暂无系统告警" max-height="440" stripe>
            <el-table-column label="告警类型" min-width="150">
                <template #default="{ row }"><el-tag type="warning" size="small">{{ row.type }}</el-tag></template>
            </el-table-column>
            <el-table-column label="产生原因" prop="reason" min-width="245" />
            <el-table-column label="产生时间" min-width="165"><template #default="{ row }">{{ DateText(row.timestamp) }}</template></el-table-column>
        </el-table>
    </section>
</template>

<script setup>
import { computed, inject, ref } from 'vue';
import { Bell } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import MonitorChartPanel from '@/components/MonitorChartPanel.vue';
import { DateText } from '@/demo/video-recognition';
import { ClearSystemAlerts, SimulateSystemOverload, SYSTEM_MONITOR } from '@/demo/system-monitor';

const monitor = inject(SYSTEM_MONITOR);
const metrics = [
    { type: 'cpu_usage', title: 'CPU使用率', color: '#1677c8', percent: true, pair: 'memory_used' },
    { type: 'memory_used', title: '内存使用率', color: '#9560ba', percent: true, pair: 'cpu_usage' },
    { type: 'npu_usage', title: 'NPU使用率', color: '#168c85', percent: true, pair: 'cpu_usage' },
    { type: 'temperature', title: '芯片温度', color: '#b57826', unit: '°C', pair: 'temperature' },
    { type: 'uplink_network', title: '上行网络流量', color: '#168c85', pair: 'downstream_network' },
    { type: 'downstream_network', title: '下行网络流量', color: '#1677c8', pair: 'uplink_network' },
    { type: 'disk_read_rate', title: '磁盘读速率', color: '#518c36', pair: 'disk_write_rate' },
    { type: 'disk_write_rate', title: '磁盘写速率', color: '#b57826', pair: 'disk_read_rate' }
];
const alertSection = ref(null);
const latestAlert = computed(() => monitor.records[0]);
const activeTab = ref('cpu_usage');
const refreshKey = ref(0);
const selected = computed(() => metrics.find(metric => metric.type === activeTab.value));
const companion = computed(() => metrics.find(metric => metric.type === selected.value.pair));

function ShowAlerts() {
    alertSection.value?.focus({ preventScroll: true });
    alertSection.value?.scrollIntoView({ block: 'start' });
}

function Simulate() {
    const count = monitor.records.length;
    SimulateSystemOverload(monitor);
    refreshKey.value++;
    if (monitor.records.length === count) {
        ElMessage.info('指标仍在同一次越限周期内');
    }
}

async function Clear() {
    try {
        await ElMessageBox.confirm('清除后无法恢复这些系统告警记录。', '清除告警', { type: 'warning', confirmButtonText: '确认清除' });
    } catch {
        return;
    }
    ClearSystemAlerts(monitor);
}
</script>

<style src="@/assets/css/video-workspace.css"></style>
<style scoped>
.monitor-alert-summary {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: #f4f7fb;
    border: 1px solid #dce6ef;
    border-radius: 8px;
    color: #415b74;
}
.monitor-alert-summary.has-alerts { background: #fff8ed; border-color: #f0d6aa; color: #8c500c; }
.monitor-alert-summary > .el-icon { flex-shrink: 0; }
.monitor-alert-copy { flex: 1; min-width: 0; }
.monitor-alert-copy h2 span { margin-left: 4px; color: #45566b; }
.monitor-alert-copy p { margin: 3px 0 0; overflow-wrap: anywhere; }
.monitor-alert-summary .el-button { flex-shrink: 0; }
.monitor-alert-records { scroll-margin-top: 12px; }
:deep(.el-tabs__item) { height: 46px; font-size: 14px; }
:deep(.el-tabs__nav-wrap::after) { background: #edf1f5; height: 1px; }
@media (max-width: 620px) {
    .monitor-alert-summary { flex-wrap: wrap; gap: 6px 8px; }
    .monitor-alert-copy { flex-basis: calc(100% - 30px); }
    .monitor-alert-summary .el-button { margin-left: 29px; }
}
</style>
