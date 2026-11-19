<template>
    <section class="recognition monitoring-container">
        <div class="video-heading recognition-header"><h1>监控运维</h1><el-tag type="info" effect="plain">Mock 演示</el-tag></div>
        <h2>整机状态</h2>
        <el-tabs v-model="activeTab">
            <el-tab-pane v-for="metric in metrics" :key="metric.type" :label="metric.title" :name="metric.type" />
        </el-tabs>
        <MonitorChartPanel :key="`${activeTab}-${refreshKey}`" :indicator-type="selected.type" :title="selected.title"
            :color="selected.color" :unit="selected.unit" :percent="selected.percent || false" :companion="companion" />
        <div class="video-heading video-divider">
            <h2>系统告警记录 <small>{{ monitor.records.length }} 条</small></h2>
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
const activeTab = ref('cpu_usage');
const refreshKey = ref(0);
const selected = computed(() => metrics.find(metric => metric.type === activeTab.value));
const companion = computed(() => metrics.find(metric => metric.type === selected.value.pair));

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
.monitoring-container { padding: 20px; background: #fff; border-radius: 12px; }
:deep(.el-tabs__item) { height: 48px; font-size: 15px; }
:deep(.el-tabs__nav-wrap::after) { background: #edf1f5; height: 1px; }
@media (max-width: 600px) { .monitoring-container { padding: 12px; } }
</style>
