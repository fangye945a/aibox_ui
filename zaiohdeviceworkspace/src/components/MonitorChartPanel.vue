<template>
  <section class="monitor-chart-panel" :style="{'--metric-color': color}">
    <div class="panel-heading">
      <div><h2>{{ title }}</h2><p>真实采样 · 每5秒更新 · {{ percent ? '使用率' : '传输速率' }}</p></div>
      <span class="mode-badge" :class="{live: live && !error, failed: error}">
        {{ error ? '更新失败' : live ? '实时监控' : historical ? '历史回看' : '已暂停' }}
      </span>
    </div>

    <div class="monitor-toolbar">
      <el-radio-group v-model="preset" @change="selectPreset" size="small" aria-label="监控时间范围">
        <el-radio-button v-for="range in ranges" :key="range.value" :label="range.value">{{ range.label }}</el-radio-button>
      </el-radio-group>
      <div class="toolbar-actions">
        <el-button v-if="live" size="small" @click="pause">暂停</el-button>
        <el-button v-else size="small" type="primary" @click="resume">恢复实时</el-button>
        <el-button size="small" :loading="loading" @click="refresh">刷新</el-button>
      </div>
    </div>
    <div v-if="preset === 'custom'" class="custom-range">
      <el-date-picker v-model="customRange" type="datetimerange" start-placeholder="开始时间"
        end-placeholder="结束时间" format="YYYY-MM-DD HH:mm:ss" :clearable="false" />
      <el-button type="primary" size="small" @click="queryHistory">查询</el-button>
    </div>

    <div class="summary-grid">
      <div class="stat primary"><span>{{ historical || zoomed ? '区间末值' : '最新采样值' }}</span>
        <strong>{{ formatMetric(stats.current, percent) }}</strong><small>{{ latestLabel }}</small></div>
      <div class="stat"><span>区间平均</span><strong>{{ formatMetric(stats.average, percent) }}</strong><small>按有效采样点计算</small></div>
      <div class="stat"><span>区间峰值</span><strong>{{ formatMetric(stats.peak, percent) }}</strong><small>{{ stats.peakAt ? formatTime(stats.peakAt) : '--' }}</small></div>
      <div class="stat"><span>{{ percent ? '最长连续高占用' : '有效采样覆盖' }}</span>
        <strong>{{ visiblePoints.length > 1 ? formatDuration(percent ? stats.longestHighSeconds : stats.coveredSeconds) : '--' }}</strong>
        <small>{{ percent ? `相邻采样均 ≥ ${threshold}%` : `${visiblePoints.length}个有效采样点` }}</small></div>
    </div>

    <div class="chart-options">
      <el-checkbox v-model="compare">对照{{ companion.title }}</el-checkbox>
      <label v-if="percent" class="threshold">高占用参考线
        <el-input-number v-model="threshold" :min="1" :max="100" :step="5" :value-on-clear="80"
          size="small" controls-position="right" />
        <span>%</span>
      </label>
      <el-button v-if="zoomed" link type="primary" @click="resetZoom">还原缩放</el-button>
    </div>
    <div class="plot-wrap">
      <div ref="chartRef" class="chart" :aria-label="`${title}时间曲线`" />
      <div v-if="!loading && !points.length" class="chart-empty">{{ error ? '数据更新失败，请重试' : '此时间范围内暂无采样数据' }}</div>
    </div>
    <div class="chart-caption">
      <span>{{ formatTime(windowStart) }} — {{ formatTime(windowEnd) }} <b v-if="zoomed">（已缩放，统计跟随可见区间）</b></span>
      <span>拖动底部滑块缩放 · 悬停查看数值</span>
    </div>

    <div class="analysis-box" aria-label="区间分析">
      <h3>区间观察</h3>
      <p v-if="error" class="error-text">{{ error }}。当前保留上次成功查询的曲线，请留意采样时间。</p>
      <p v-if="!visiblePoints.length">当前区间无有效数据，无法分析负载变化。</p>
      <template v-else>
        <p v-if="percent">参考线 {{ threshold }}%：累计高占用 {{ formatDuration(stats.highSeconds) }}，
          最长连续 {{ formatDuration(stats.longestHighSeconds) }}。{{ highAdvice }}</p>
        <p v-else>峰值 {{ formatMetric(stats.peak, false) }}，发生于 {{ formatTime(stats.peakAt) }}。
          {{ rateObservation }}</p>
        <p v-if="compare">同一时间轴对照{{ companion.title }}，区间峰值 {{ formatMetric(companionStats.peak, percent) }}。
          同时升高可作为排查线索，无法仅据此确定原因。</p>
        <p v-if="stats.gaps">区间存在 {{ stats.gaps }} 处超过15秒的采样间断，曲线断开，间断不计入连续时长。</p>
        <p v-if="live && stale" class="error-text">最新采样已超过15秒未更新，请检查设备采集状态。</p>
      </template>
      <div class="data-note">最近成功查询：{{ fetchedAt ? formatTime(fetchedAt) : '--' }} · 历史最多保留24小时，Web服务重启后重新积累。
        <br>参考线用于观察负载，不是故障判定；进程归因、内存泄漏及I/O瓶颈需结合进程信息和日志分析。</div>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import { ElMessage } from 'element-plus';
import { getMnitoring } from '@/api/api.monitoring';
import { chartPoints, formatDuration, formatMetric, normalizePoints, summarize } from '@/utils/monitor';

const props = defineProps({
  indicatorType: {type: String, required: true}, title: {type: String, required: true},
  color: {type: String, required: true}, percent: Boolean,
  companion: {type: Object, required: true}
});
const ranges = [
  {value: 1, label: '1分钟'}, {value: 5, label: '5分钟'}, {value: 15, label: '15分钟'},
  {value: 60, label: '1小时'}, {value: 'custom', label: '自定义'}
];
const preset = ref(5);
const live = ref(true);
const historical = ref(false);
const compare = ref(false);
const threshold = ref(80);
const customRange = ref([new Date(Date.now() - 3600000), new Date()]);
const windowStart = ref(Date.now() - 300000);
const windowEnd = ref(Date.now());
const points = ref([]);
const otherPoints = ref([]);
const fetchedAt = ref(null);
const clock = ref(Date.now());
const error = ref('');
const loading = ref(false);
const chartRef = ref(null);
const zoom = ref([0, 100]);
const zoomed = computed(() => zoom.value[0] > 0 || zoom.value[1] < 100);
const visibleBounds = computed(() => zoom.value.map(value => windowStart.value +
  (windowEnd.value - windowStart.value) * value / 100));
const inView = point => point[0] >= visibleBounds.value[0] && point[0] <= visibleBounds.value[1];
const visiblePoints = computed(() => points.value.filter(inView));
const stats = computed(() => summarize(visiblePoints.value, props.percent ? threshold.value : null));
const companionStats = computed(() => summarize(otherPoints.value.filter(inView), null));
const stale = computed(() => points.value.length && clock.value - points.value[points.value.length - 1][0] > 15000);
const latestLabel = computed(() => {
  if (!visiblePoints.value.length) return '暂无采样';
  return formatTime(visiblePoints.value[visiblePoints.value.length - 1][0]);
});
const highAdvice = computed(() => visiblePoints.value.length < 2 ? '采样不足，暂不能判断持续时间。' :
  stats.value.highSeconds > 0 ? '可对照其他指标及同时间段日志排查持续占用。' :
    '未观察到连续高占用；单次峰值请结合曲线查看。');
const rateObservation = computed(() => {
  const {peak, average} = stats.value;
  if (visiblePoints.value.length < 2) return '采样不足，暂不能分析速率变化。';
  if (peak === 0) return '本区间有效采样中未观察到传输活动。';
  return average > 0 ? `峰值为采样均值的 ${(peak / average).toFixed(1)} 倍，可定位突发传输时段。` : '';
});
let chart = null;
let observer = null;
let timer = null;
let requestId = 0;
let controller = null;
let disposed = false;

function formatTime(value) {
  return new Date(value).toLocaleString('zh-CN', {hour12: false});
}
function axisTime(value) {
  return new Date(value).toLocaleTimeString('zh-CN', {hour12: false});
}
function series(name, data, color, secondary = false) {
  return {
    name, type: 'line', data: chartPoints(data), smooth: false, connectNulls: false,
    showSymbol: data.length === 1, symbolSize: 5, lineStyle: {width: secondary ? 1.5 : 2, type: secondary ? 'dashed' : 'solid'},
    itemStyle: {color}, emphasis: {focus: 'series'},
    areaStyle: secondary ? undefined : {color: new echarts.graphic.LinearGradient(0, 0, 0, 1,
      [{offset: 0, color: echarts.color.modifyAlpha(color, 0.25)}, {offset: 1, color: echarts.color.modifyAlpha(color, 0.03)}])},
    markLine: props.percent && !secondary ? {
      silent: true, symbol: 'none', lineStyle: {color: '#b78632', type: 'dashed', width: 1},
      label: {formatter: `参考 ${threshold.value}%`, position: 'insideEndTop'}, data: [{yAxis: threshold.value}]
    } : undefined
  };
}
function render() {
  if (!chart) return;
  const data = [series(props.title, points.value, props.color)];
  if (compare.value) data.push(series(props.companion.title, otherPoints.value, props.companion.color, true));
  const max = Math.max(0, ...points.value.map(p => p[1]), ...(compare.value ? otherPoints.value.map(p => p[1]) : []));
  const divisor = !props.percent && max >= 1048576 ? 1048576 : !props.percent && max >= 1024 ? 1024 : 1;
  const unit = props.percent ? '%' : divisor === 1048576 ? 'GiB/s' : divisor === 1024 ? 'MiB/s' : 'KiB/s';
  chart.setOption({
    animation: false,
    color: [props.color, props.companion.color],
    legend: {show: compare.value, top: 0, left: 60, icon: 'roundRect', itemHeight: 3, textStyle: {color: '#64748b'}},
    grid: {left: 65, right: 24, top: 40, bottom: 75},
    tooltip: {trigger: 'axis', confine: true, renderMode: 'richText',
      axisPointer: {type: 'line', lineStyle: {color: '#94a3b8', type: 'dashed'}},
      formatter: params => {
        if (!params.length) return '';
        return formatTime(params[0].value[0]) + '\n' + params.map(p =>
          `${p.seriesName}  ${formatMetric(p.value[1], props.percent)}`).join('\n');
      }},
    xAxis: {type: 'time', min: windowStart.value, max: windowEnd.value, splitNumber: 5,
      axisLabel: {formatter: axisTime, color: '#64748b', hideOverlap: true}, axisTick: {show: false},
      axisLine: {lineStyle: {color: '#dce5ee'}}, splitLine: {show: true, lineStyle: {color: '#edf2f7'}}},
    yAxis: {type: 'value', min: 0, max: props.percent ? 100 : max > 0 ? undefined : 1, splitNumber: 5,
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
function cancelQuery() {
  requestId++;
  controller?.abort();
  controller = null;
  loading.value = false;
}
function timeWindow() {
  const end = Date.now();
  return [end - Number(preset.value === 'custom' ? 5 : preset.value) * 60000, end];
}
async function load(bounds, automatic = false) {
  if (automatic && loading.value) return;
  cancelQuery();
  const id = requestId;
  controller = new AbortController();
  const signal = controller.signal;
  loading.value = true;
  try {
    const params = {start_time: new Date(bounds[0]).toISOString(), end_time: new Date(bounds[1]).toISOString()};
    const kinds = [props.indicatorType, props.companion.type];
    const results = await Promise.all(kinds.map(type => getMnitoring({...params, type}, signal)));
    if (disposed || id !== requestId) return;
    const parsed = results.map((result, index) => {
      if (Number(result?.code) !== 0 || !Array.isArray(result?.data?.[kinds[index]])) {
        throw new Error('监控数据格式错误');
      }
      return normalizePoints(result.data[kinds[index]]);
    });
    [points.value, otherPoints.value] = parsed;
    [windowStart.value, windowEnd.value] = bounds;
    fetchedAt.value = Date.now();
    error.value = '';
    render();
  } catch (err) {
    if (disposed || id !== requestId || signal.aborted) return;
    error.value = err.message || '无法获取监控数据';
  } finally {
    if (id === requestId) loading.value = false;
  }
}
function selectPreset(value) {
  cancelQuery();
  resetZoom();
  if (value === 'custom') {
    live.value = false;
    historical.value = true;
    customRange.value = [new Date(windowStart.value), new Date(windowEnd.value)];
    return;
  }
  live.value = true;
  historical.value = false;
  load(timeWindow());
}
function pause() {
  live.value = false;
  cancelQuery();
}
function resume() {
  if (preset.value === 'custom') preset.value = 5;
  live.value = true;
  historical.value = false;
  resetZoom();
  load(timeWindow());
}
function refresh() {
  load(live.value ? timeWindow() : [windowStart.value, windowEnd.value]);
}
function queryHistory() {
  const bounds = customRange.value?.map(value => new Date(value).getTime());
  if (!bounds || bounds.length !== 2 || !bounds.every(Number.isFinite) || bounds[0] >= bounds[1]) {
    ElMessage.warning('请选择有效的开始时间和结束时间，开始时间须早于结束时间');
    return;
  }
  if (bounds[1] - bounds[0] > 7 * 86400000) {
    ElMessage.warning('查询范围不能超过7天，当前历史最多保留24小时');
    return;
  }
  live.value = false;
  historical.value = true;
  resetZoom();
  load(bounds);
}
watch([compare, threshold], render);
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
  render();
  load(timeWindow());
  timer = setInterval(() => {
    clock.value = Date.now();
    if (live.value && !document.hidden) load(timeWindow(), true);
  }, 5000);
});
onUnmounted(() => {
  disposed = true;
  cancelQuery();
  clearInterval(timer);
  observer?.disconnect();
  chart?.dispose();
  chart = null;
});
</script>

<style scoped>
.monitor-chart-panel { color: #24364b; }
.panel-heading, .monitor-toolbar, .chart-options, .chart-caption { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.panel-heading { padding: 10px 0 22px; }
h2 { margin: 0 0 7px; font-size: 24px; font-weight: 600; }
.panel-heading p { margin: 0; color: #75869a; font-size: 13px; }
.mode-badge { background: #f0f3f7; color: #64748b; padding: 7px 12px; border-radius: 20px; font-size: 12px; }
.mode-badge.live { background: #edf8f5; color: #16856d; }
.mode-badge.live::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #22a380; margin-right: 7px; }
.mode-badge.failed { background: #fff1ed; color: #a64a28; }
.monitor-toolbar { padding-bottom: 20px; }
.toolbar-actions { display: flex; }
.custom-range { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; }
.custom-range :deep(.el-date-editor) { max-width: 100%; flex: 0 1 430px; }
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
.analysis-box { border-top: 1px solid #e8edf3; padding: 18px 4px 5px; }
h3 { margin: 0 0 10px; font-size: 14px; font-weight: 600; }
.analysis-box p { margin: 6px 0; font-size: 13px; color: #53667b; line-height: 1.8; }
.analysis-box .error-text { color: #ae5427; }
.data-note { color: #8997a6; font-size: 12px; margin-top: 12px; line-height: 1.8; }
@media (max-width: 800px) { .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .stat { padding: 12px; } .stat:nth-child(2) { border-right: 0; } .stat:nth-child(-n+2) { border-bottom: 1px solid #e4ebf2; } .chart { height: 300px; } }
@media (max-width: 500px) { .threshold { margin-left: 0; } h2 { font-size: 21px; } .stat strong { font-size: 21px; } }
</style>
