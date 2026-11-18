<template>
  <div class="monitoring-container">
    <el-tabs v-model="activeTab">
      <el-tab-pane v-for="metric in metrics" :key="metric.type" :label="metric.title" :name="metric.type" />
    </el-tabs>
    <MonitorChartPanel :key="activeTab" :indicator-type="selected.type" :title="selected.title"
      :color="selected.color" :percent="selected.percent || false" :companion="companion" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import MonitorChartPanel from '@/components/MonitorChartPanel.vue';

const metrics = [
  {type: 'cpu_usage', title: 'CPU使用率', color: '#1677c8', percent: true, pair: 'memory_used'},
  {type: 'memory_used', title: '内存使用率', color: '#9560ba', percent: true, pair: 'cpu_usage'},
  {type: 'uplink_network', title: '上行网络流量', color: '#168c85', pair: 'downstream_network'},
  {type: 'downstream_network', title: '下行网络流量', color: '#1677c8', pair: 'uplink_network'},
  {type: 'disk_read_rate', title: '磁盘读速率', color: '#518c36', pair: 'disk_write_rate'},
  {type: 'disk_write_rate', title: '磁盘写速率', color: '#b57826', pair: 'disk_read_rate'}
];
const activeTab = ref('cpu_usage');
const selected = computed(() => metrics.find(metric => metric.type === activeTab.value));
const companion = computed(() => metrics.find(metric => metric.type === selected.value.pair));
</script>

<style scoped>
.monitoring-container { padding: 20px; background: #fff; border-radius: 12px; }
:deep(.el-tabs__item) { height: 48px; font-size: 15px; }
:deep(.el-tabs__nav-wrap::after) { background: #edf1f5; height: 1px; }
@media (max-width: 600px) { .monitoring-container { padding: 12px; } }
</style>
