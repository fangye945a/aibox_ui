<template>
  <div class="monitoring-container">
    <div class="monitor-alert-summary" :class="{'has-alerts': alertStatus?.level === 'warning' || alertStatus?.level === 'error'}">
      <el-icon :size="21"><Bell /></el-icon>
      <div class="monitor-alert-copy"><h2>系统告警 <span>{{ alertTotal }} 条</span></h2>
        <p>{{ alertStatus?.message || '正在读取告警状态' }}</p></div>
      <el-button link type="primary" @click="showAlerts">查看告警记录</el-button>
    </div>
    <div class="mobile-metric-picker">
      <label for="mobile-metric">监控指标</label>
      <select id="mobile-metric" v-model="activeTab">
        <option v-for="metric in metrics" :key="metric.type" :value="metric.type">{{ metric.title }}</option>
      </select>
    </div>
    <el-tabs v-model="activeTab" class="monitor-metric-tabs">
      <el-tab-pane v-for="metric in metrics" :key="metric.type" :label="metric.title" :name="metric.type" />
    </el-tabs>
    <MonitorChartPanel :key="activeTab" :indicator-type="selected.type" :title="selected.title"
      :samples="samples" :connected="streamConnected" :error="streamError"
      :color="selected.color" :percent="selected.percent || false" :companion="companion" :unit="selected.unit || ''" />
    <section ref="alertSection" class="monitor-alert-records" tabindex="-1" aria-label="系统告警记录">
      <div class="alert-heading"><h2>系统告警记录 <small>{{ alertTotal }} 条</small></h2>
        <div><el-button size="small" class="alert-refresh" :loading="alertRefreshing" @click="loadAlerts(true)">刷新</el-button>
          <el-button size="small" type="danger" plain @click="clearAlerts">清除已恢复告警</el-button></div></div>
      <el-alert v-if="alertError" :title="alertError" type="warning" :closable="false" />
      <el-table :data="alertRecords" row-key="id" empty-text="暂无系统告警" stripe max-height="440">
        <el-table-column label="告警类型" min-width="120"><template #default="{row}">
          <el-tag :type="row.level === 'error' ? 'danger' : 'warning'" size="small">{{ row.source }}</el-tag>
        </template></el-table-column>
        <el-table-column label="产生原因" prop="message" min-width="245" />
        <el-table-column label="产生时间" min-width="165"><template #default="{row}">{{ dateText(row.timestamp) }}</template></el-table-column>
        <el-table-column label="状态" min-width="100"><template #default="{row}">
          <el-tag :type="row.active ? 'warning' : 'success'" size="small">{{ row.active ? '活动' : '已恢复' }}</el-tag>
        </template></el-table-column>
        <el-table-column label="恢复时间" min-width="165"><template #default="{row}">{{ dateText(row.resolvedAt) }}</template></el-table-column>
      </el-table>
      <el-pagination v-model:current-page="alertPage" :total="alertTotal" :page-size="20" layout="prev, pager, next, total" @current-change="loadAlerts()" />
    </section>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { Bell } from '@element-plus/icons-vue';
import { EventSourcePolyfill } from 'event-source-polyfill';
import { DemoEventSource, demoEnabled } from '@/demo/data';
import { ElMessageBox } from 'element-plus';
import { getMonitorAlerts, clearMonitorAlerts } from '@/api/api.monitoring';
import MonitorChartPanel from '@/components/MonitorChartPanel.vue';

const metrics = [
  {type: 'cpu_usage', title: 'CPU使用率', color: '#1677c8', percent: true, pair: 'memory_used'},
  {type: 'memory_used', title: '内存使用率', color: '#9560ba', percent: true, pair: 'cpu_usage'},
  {type: 'npu_usage', title: 'NPU使用率', color: '#168c85', percent: true, pair: 'cpu_usage'},
  {type: 'temperature', title: '芯片温度', color: '#b57826', unit: '°C', pair: 'temperature'},
  {type: 'uplink_network', title: '上行网络流量', color: '#168c85', pair: 'downstream_network'},
  {type: 'downstream_network', title: '下行网络流量', color: '#1677c8', pair: 'uplink_network'},
  {type: 'disk_read_rate', title: '磁盘读速率', color: '#518c36', pair: 'disk_write_rate'},
  {type: 'disk_write_rate', title: '磁盘写速率', color: '#b57826', pair: 'disk_read_rate'}
];
const activeTab = ref('cpu_usage');
const selected = computed(() => metrics.find(metric => metric.type === activeTab.value));
const companion = computed(() => metrics.find(metric => metric.type === selected.value.pair));
const alertSection = ref(null);
const alertRecords = ref([]);
const alertTotal = ref(0);
const alertPage = ref(1);
const alertStatus = ref(null);
const alertError = ref('');
const alertLoading = ref(false);
const alertRefreshing = ref(false);
let alertTimer = null;
let alertController = null;
let disposed = false;
const samples = ref([]);
const streamConnected = ref(false);
const streamError = ref('');
let stream = null;
let reconnect = null;
function closeMonitoring() {
  clearTimeout(reconnect);
  reconnect = null;
  stream?.close();
  stream = null;
}
function openMonitoring() {
  closeMonitoring();
  const token = localStorage.getItem('loginToken');
  if (disposed || !token) return;
  const connection = demoEnabled ? new DemoEventSource('/api/monitoring/stream') : new EventSourcePolyfill('/api/monitoring/stream', {
    headers: {Authorization: 'Bearer ' + token},
    heartbeatTimeout: 10000
  });
  stream = connection;
  connection.onopen = () => {
    if (stream !== connection) return;
    samples.value = [];
    streamConnected.value = true;
    streamError.value = '';
  };
  connection.onmessage = event => {
    if (stream !== connection) return;
    try {
      const batch = JSON.parse(event.data);
      if (!Array.isArray(batch) || !batch.length) return;
      const incoming = batch.map(sample => ({time: Date.parse(sample.time), values: sample.values}))
        .filter(sample => Number.isFinite(sample.time));
      if (!incoming.length) return;
      const cutoff = incoming.at(-1).time - 60000;
      samples.value = [...samples.value, ...incoming].filter(sample => sample.time > cutoff).slice(-60);
    } catch {
      streamError.value = '监控数据读取失败';
    }
  };
  connection.onerror = () => {
    if (stream !== connection) return;
    closeMonitoring();
    streamConnected.value = false;
    streamError.value = '监控连接中断，正在重连';
    reconnect = setTimeout(openMonitoring, 3000);
  };
}
function dateText(value) {return value ? new Date(value).toLocaleString('zh-CN', {hour12: false}) : '--';}
function showAlerts() {alertSection.value?.focus({preventScroll: true});alertSection.value?.scrollIntoView({block: 'start'});}
async function loadAlerts(showRefresh = false) {
  alertController?.abort();
  const controller = new AbortController();alertController = controller;
  alertLoading.value = true;
  alertRefreshing.value = showRefresh;
  try {
    const response = await getMonitorAlerts(alertPage.value, controller.signal);
    if (disposed || controller.signal.aborted) return;
    alertRecords.value = response.data.records;alertTotal.value = response.data.total;
    alertStatus.value = response.data.status;alertError.value = '';
    if (alertPage.value > 1 && (alertPage.value - 1) * 20 >= alertTotal.value) {
      alertPage.value = Math.max(1, Math.ceil(alertTotal.value / 20));loadAlerts();
    }
  } catch (error) {if (!disposed && !controller.signal.aborted) alertError.value = error.message;}
  finally {
    if (alertController === controller) {
      alertLoading.value = false;
      alertRefreshing.value = false;
    }
  }
}
async function clearAlerts() {
  try {await ElMessageBox.confirm('仅清除已恢复告警，活动告警将保留。清除后无法恢复。', '清除告警', {type: 'warning'});}
  catch {return;}
  try {await clearMonitorAlerts();alertPage.value = 1;await loadAlerts();}
  catch (error) {alertError.value = error.message;}
}
onMounted(() => {openMonitoring();loadAlerts();alertTimer = setInterval(() => {if (!document.hidden && !alertLoading.value) loadAlerts();}, 5000);});
onUnmounted(() => {disposed = true;closeMonitoring();clearInterval(alertTimer);alertController?.abort();});
</script>

<style scoped>
.monitoring-container { padding: 20px; background: #fff; border-radius: 12px; }
:deep(.el-tabs__item) { height: 48px; font-size: 15px; }
:deep(.el-tabs__nav-wrap::after) { background: #edf1f5; height: 1px; }
@media (max-width: 600px) { .monitoring-container { padding: 12px; } }

.monitor-alert-summary {display: flex;align-items: center;gap: 10px;padding: 12px 16px;margin-bottom: 16px;border: 1px solid #e4ebf2;border-radius: 8px;background: #f6f9fc;color: #53667b;}
.monitor-alert-summary.has-alerts {background: #fff8ed;border-color: #f0d6aa;color: #8c500c;}
.monitor-alert-copy {flex: 1;min-width: 0;}
.monitor-alert-copy h2, .alert-heading h2 {margin: 0;font-size: 15px;font-weight: 600;}
.monitor-alert-copy p {margin: 3px 0 0;font-size: 14px;}
.monitor-alert-records {margin-top: 20px;border-top: 1px solid #eee;padding-top: 16px;scroll-margin-top: 12px;}
.alert-heading {display: flex;align-items: center;justify-content: space-between;gap: 10px;flex-wrap: wrap;margin-bottom: 14px;}
.alert-heading .alert-refresh {width: 80px;}
.alert-heading small {font-weight: 400;color: #697987;}
.el-pagination {margin-top: 14px;max-width: 100%;overflow-x: auto;}
@media (max-width: 620px) {.monitor-alert-summary {flex-wrap: wrap;} .monitor-alert-copy {flex-basis: calc(100% - 40px);}}

.mobile-metric-picker { display: none; }
@media (max-width: 767px) {
  .monitoring-container { padding: 12px; }
  .monitor-metric-tabs { display: none; }
  .mobile-metric-picker { display: grid; gap: 6px; }
  .mobile-metric-picker select {
    width: 100%;
    min-height: 44px;
    padding: 8px;
    border: 1px solid #dce5ee;
    border-radius: 6px;
    background: #fff;
    color: #24364b;
    font-size: 16px;
  }
  .monitor-alert-summary { flex-wrap: wrap; align-items: flex-start; }
  .monitor-alert-summary .el-button { margin-inline-start: 30px; min-height: 36px; }
  .alert-heading > div { display: flex; flex-wrap: wrap; gap: 8px; }
  .alert-heading .el-button { margin-left: 0; min-height: 36px; }
  .monitor-alert-records :deep(.el-table__body .cell) { overflow-wrap: anywhere; }
}

</style>
