// 后端每秒采样；超过3秒视为缺采，不跨缺口推断持续时间。
export const SAMPLE_MS = 1000;
export const GAP_MS = 3000;

export function normalizePoints(items, minimum = 0) {
  const values = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const time = typeof item?.time === 'number' ? item.time : Date.parse(item?.time);
    if (Number.isFinite(time) && typeof item?.value === 'number' &&
        Number.isFinite(item.value) && item.value >= minimum) {
      values.set(time, item.value);
    }
  }
  return [...values].sort((a, b) => a[0] - b[0]);
}

export function chartPoints(points, gapMs = GAP_MS) {
  const result = [];
  points.forEach((point, index) => {
    if (index && point[0] - points[index - 1][0] > gapMs) {
      result.push([points[index - 1][0] + SAMPLE_MS, null]);
    }
    result.push(point);
  });
  return result;
}

export function summarize(points, threshold, gapMs = GAP_MS) {
  const stats = {
    current: null, average: null, peak: null, peakAt: null,
    highSeconds: 0, longestHighSeconds: 0, coveredSeconds: 0, gaps: 0
  };
  let total = 0;
  let highRun = 0;
  points.forEach(([time, value], index) => {
    total += value;
    stats.current = value;
    if (stats.peak === null || value > stats.peak) {
      stats.peak = value;
      stats.peakAt = time;
    }
    if (index) {
      const elapsed = time - points[index - 1][0];
      if (elapsed > gapMs) {
        stats.gaps++;
        highRun = 0;
      } else {
        stats.coveredSeconds += elapsed / 1000;
        if (Number.isFinite(threshold) && value >= threshold && points[index - 1][1] >= threshold) {
          highRun += elapsed / 1000;
          stats.highSeconds += elapsed / 1000;
          stats.longestHighSeconds = Math.max(stats.longestHighSeconds, highRun);
        } else {
          highRun = 0;
        }
      }
    }
  });
  stats.average = points.length ? total / points.length : null;
  return stats;
}

export function formatMetric(value, percent, unit) {
  if (value === null || !Number.isFinite(value)) return '--';
  if (unit === '°C') return `${value.toFixed(1)} °C`;
  if (percent) return `${value.toFixed(1)}%`;
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} GiB/s`;
  if (value >= 1024) return `${(value / 1024).toFixed(2)} MiB/s`;
  return `${value.toFixed(2)} KiB/s`;
}

export function formatDuration(seconds) {
  const rounded = Math.floor(seconds);
  if (rounded < 60) return `${rounded}秒`;
  if (rounded < 3600) return `${Math.floor(rounded / 60)}分${rounded % 60}秒`;
  return `${Math.floor(rounded / 3600)}小时${Math.floor(rounded % 3600 / 60)}分`;
}
