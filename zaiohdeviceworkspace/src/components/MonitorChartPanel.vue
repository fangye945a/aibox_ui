<template>
  <section class="monitor-chart-panel" :style="{'--metric-color': color}">
    <div class="monitor-toolbar">
      <span class="window-label">最近 60 秒</span>
      <div class="toolbar-actions">
        <span class="mode-badge" :class="{live: live && connected && !error, failed: error}">
          {{ error ? '连接中断' : !live ? '已暂停' : connected ? '实时监控' : '连接中' }}
        </span>
        <el-button size="small" :type="live ? 'default' : 'primary'" @click="live ? pause() : resume()">
          {{ live ? '暂停' : '恢复实时' }}
        </el-button>
      </div>
    </div>

    <div class="summary-grid">
      <div class="stat primary"><span>{{ !live || zoomed ? '区间末值' : '最新采样值' }}</span>
        <strong>{{ formatValue(stats.current) }}</strong><small>{{ latestLabel }}</small></div>
      <div class="stat"><span>区间平均</span><strong>{{ formatValue(stats.average) }}</strong><small>按有效采样点计算</small></div>
      <div class="stat"><span>区间峰值</span><strong>{{ formatValue(stats.peak) }}</strong><small>{{ stats.peakAt ? formatTime(stats.peakAt) : '--' }}</small></div>
      <div class="stat"><span>{{ isUsage ? '最长连续越限' : '有效采样覆盖' }}</span>
        <strong>{{ visiblePoints.length > 1 ? formatDuration(isUsage ? stats.longestHighSeconds : stats.coveredSeconds) : '--' }}</strong>
        <small>{{ isUsage ? `相邻采样均 ≥ ${threshold}${unit || '%'}` : `${visiblePoints.length}个有效采样点` }}</small></div>
    </div>

    <div class="chart-options">
      <el-checkbox v-if="companion.type !== indicatorType" v-model="compare">对照{{ companion.title }}</el-checkbox>
      <label v-if="isUsage" class="threshold">统计阈值
        <el-input-number v-model="threshold" :min="1" :max="unit === '°C' ? 150 : 100" :step="5" :value-on-clear="80"
          size="small" aria-label="统计阈值" controls-position="right" />
        <span>{{ unit || '%' }}</span>
      </label>
      <el-button v-if="zoomed" link type="primary" @click="resetZoom">还原缩放</el-button>
    </div>
    <div class="plot-wrap">
      <div ref="chartRef" class="chart" :aria-label="`${title}时间曲线`" />
      <div v-if="!points.length" class="chart-empty">{{ error ? '连接中断，正在重连' : '等待采样数据' }}</div>
    </div>
    <div class="chart-caption">
      <span>{{ formatTime(windowStart) }} — {{ formatTime(windowEnd) }} <b v-if="zoomed">（已缩放，统计跟随可见区间）</b></span>
    </div>
    <p v-if="error && points.length" class="chart-notice" role="status">{{ error }}</p>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import { GAP_MS, chartPoints, formatDuration, formatMetric, normalizePoints, summarize } from '@/utils/monitor';

const props = defineProps({
  indicatorType: {type: String, required: true}, title: {type: String, required: true},
  color: {type: String, required: true}, percent: Boolean, unit: {type: String, default: ''},
  companion: {type: Object, required: true},
  samples: {type: Array, required: true},
  connected: Boolean,
  error: {type: String, default: ''}
});
const isUsage = computed(() => props.percent || props.unit === '°C');
function formatValue(value) { return formatMetric(value, props.percent, props.unit); }
const live = ref(true);
const compare = ref(false);
const threshold = ref(80);
const windowStart = ref(Date.now() - 60000);
const windowEnd = ref(Date.now());
const displayedSamples = ref([]);
function metricPoints(kind) {
  const items = displayedSamples.value.map(sample => ({time: sample.time, value: sample.values?.[kind]}));
  return normalizePoints(items, props.unit === '°C' ? -40 : 0);
}
const points = computed(() => metricPoints(props.indicatorType));
const otherPoints = computed(() => metricPoints(props.companion.type));
const chartRef = ref(null);
const zoom = ref([0, 100]);
const zoomed = computed(() => zoom.value[0] > 0 || zoom.value[1] < 100);
const visibleBounds = computed(() => zoom.value.map(value => windowStart.value +
  (windowEnd.value - windowStart.value) * value / 100));
const inView = point => point[0] >= visibleBounds.value[0] && point[0] <= visibleBounds.value[1];
const visiblePoints = computed(() => points.value.filter(inView));
const stats = computed(() => summarize(visiblePoints.value, isUsage.value ? threshold.value : null, GAP_MS));
const latestLabel = computed(() => {
  if (!visiblePoints.value.length) return '暂无采样';
  return formatTime(visiblePoints.value[visiblePoints.value.length - 1][0]);
});
let chart = null;
let observer = null;
let disposed = false;

function formatTime(value) {
  return new Date(value).toLocaleString('zh-CN', {hour12: false});
}
function axisTime(value) {
  const date = new Date(value);
  return date.toLocaleTimeString('zh-CN', {hour12: false});
}
function series(name, data, color, secondary = false) {
  return {
    name, type: 'line', data: chartPoints(data, GAP_MS), smooth: false, connectNulls: false,
    showSymbol: data.length === 1, symbolSize: 5, lineStyle: {width: secondary ? 1.5 : 2, type: secondary ? 'dashed' : 'solid'},
    itemStyle: {color}, emphasis: {focus: 'series'},
    areaStyle: secondary ? undefined : {color: new echarts.graphic.LinearGradient(0, 0, 0, 1,
      [{offset: 0, color: echarts.color.modifyAlpha(color, 0.25)}, {offset: 1, color: echarts.color.modifyAlpha(color, 0.03)}])}
  };
}
function render() {
  if (!chart) return;
  const data = [series(props.title, points.value, props.color)];
  if (compare.value) data.push(series(props.companion.title, otherPoints.value, props.companion.color, true));
  const max = Math.max(0, ...points.value.map(p => p[1]), ...(compare.value ? otherPoints.value.map(p => p[1]) : []));
  const divisor = !props.percent && !props.unit && max >= 1048576 ? 1048576 : !props.percent && !props.unit && max >= 1024 ? 1024 : 1;
  const unit = props.unit || (props.percent ? '%' : divisor === 1048576 ? 'GiB/s' : divisor === 1024 ? 'MiB/s' : 'KiB/s');
  chart.setOption({
    textStyle: {fontFamily: getComputedStyle(document.body).fontFamily},
    animation: false,
    color: [props.color, props.companion.color],
    legend: {show: compare.value, top: 0, left: 60, icon: 'roundRect', itemHeight: 3, textStyle: {color: '#64748b'}},
    grid: {left: 65, right: 24, top: 40, bottom: 75},
    tooltip: {trigger: 'axis', confine: true, renderMode: 'richText',
      axisPointer: {type: 'line', lineStyle: {color: '#94a3b8', type: 'dashed'}},
      formatter: params => {
        if (!params.length) return '';
        return formatTime(params[0].value[0]) + '\n' + params.map(p =>
          `${p.seriesName}  ${formatValue(p.value[1])}`).join('\n');
      }},
    xAxis: {type: 'time', min: windowStart.value, max: windowEnd.value, splitNumber: 5,
      axisLabel: {formatter: axisTime, color: '#64748b', hideOverlap: true}, axisTick: {show: false},
      axisLine: {lineStyle: {color: '#dce5ee'}}, splitLine: {show: true, lineStyle: {color: '#edf2f7'}}},
    yAxis: {type: 'value', min: props.unit === '°C' ? Math.min(0, ...points.value.map(p => p[1])) : 0, max: props.percent ? 100 : props.unit === '°C' ? Math.max(100, Math.ceil(max / 20) * 20) : max > 0 ? undefined : 1, splitNumber: 5,
      name: unit, nameTextStyle: {color: '#64748b', align: 'right'},
      axisLabel: {color: '#64748b', formatter: value => `${Number((value / divisor).toFixed(2))}${props.percent ? '%' : ''}`},
      splitLine: {lineStyle: {color: '#e7eef5'}}, axisTick: {show: false}, axisLine: {show: false}},
    dataZoom: [{type: 'slider', start: zoom.value[0], end: zoom.value[1], bottom: 12, height: 24,
      borderColor: '#dce5ee', fillerColor: '#1677c815', textStyle: {color: '#64748b'},
      labelFormatter: axisTime, filterMode: 'none'}],
    series: data
  }, {notMerge: true});
}
function resetZoom() {
  zoom.value = [0, 100];
  render();
}
function renderLatest() {
  displayedSamples.value = props.samples;
  windowEnd.value = props.samples.at(-1)?.time ?? Date.now();
  windowStart.value = windowEnd.value - 60000;
  render();
}
function pause() {
  live.value = false;
}
function resume() {
  live.value = true;
  zoom.value = [0, 100];
  renderLatest();
}
watch(() => props.samples, () => {
  if (live.value) renderLatest();
});
watch(compare, render);
onMounted(async () => {
  await nextTick();
  if (disposed) return;
  chart = echarts.init(chartRef.value);
  chart.on('datazoom', event => {
    const value = event.batch?.[0] || event;
    zoom.value = [value.start ?? 0, value.end ?? 100];
    // 缩放后冻结时间窗口，防止实时滚动改变正在查看的区间。
    pause();
  });
  observer = new ResizeObserver(() => chart?.resize());
  observer.observe(chartRef.value);
  renderLatest();
});
onUnmounted(() => {
  disposed = true;
  observer?.disconnect();
  chart?.dispose();
  chart = null;
});
</script>

<style scoped>
.monitor-chart-panel { color: #24364b; }
.monitor-toolbar, .chart-options, .chart-caption { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.mode-badge { min-width: 82px; box-sizing: border-box; text-align: center; background: #f0f3f7; color: #64748b; padding: 7px 12px; border-radius: 20px; font-size: 12px; }
.mode-badge.live { background: #edf8f5; color: #16856d; }
.mode-badge.live::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #22a380; margin-right: 7px; }
.mode-badge.failed { background: #fff1ed; color: #a64a28; }
.monitor-toolbar { padding: 12px 0 16px; }
.window-label { font-size: 13px; color: #53667b; }
.toolbar-actions { display: flex; align-items: center; gap: 8px; }
.toolbar-actions :deep(.el-button) { width: 80px; margin-left: 0; }
.summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid #e4ebf2; border-radius: 8px; background: #fafcfe; margin-bottom: 16px; }
.stat { padding: 18px 20px; min-width: 0; border-right: 1px solid #e4ebf2; }
.stat:last-child { border-right: 0; }
.stat span, .stat small { display: block; font-size: 12px; color: #75869a; line-height: 1.6; }
.stat strong { display: block; font-size: clamp(19px, 2vw, 30px); font-weight: 500; margin: 6px 0; line-height: 1.3; }
.primary strong { color: var(--metric-color); }
.chart-options { min-height: 40px; justify-content: flex-start; font-size: 12px; color: #75869a; }
.threshold { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.threshold :deep(.el-input-number) { width: 85px; }
.plot-wrap { position: relative; }
.chart { width: 100%; height: 350px; }
.chart-empty { position: absolute; top: 45%; left: 0; width: 100%; text-align: center; color: #8999a9; pointer-events: none; }
.chart-caption { padding: 3px 10px 16px; color: #8090a2; font-size: 12px; }
.chart-caption b { font-weight: 400; color: #1677c8; }
.chart-notice { margin: 0 10px 12px; color: #ae5427; font-size: 13px; }
@media (max-width: 800px) { .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .stat { padding: 12px; } .stat:nth-child(2) { border-right: 0; } .stat:nth-child(-n+2) { border-bottom: 1px solid #e4ebf2; } .chart { height: 300px; } }
@media (max-width: 500px) { .threshold { margin-left: 0; } .stat strong { font-size: 21px; } }
</style>
