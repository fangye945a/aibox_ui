// 监控统计使用实际时间间隔，缺采不能算连续高负载或零值。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/utils/monitor.js'), 'utf8');
  const { normalizePoints, summarize, chartPoints, formatMetric } = await import(
    'data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const at = (seconds) => new Date(1700000000000 + seconds * 1000).toISOString();
  const points = normalizePoints([
    {time: at(40), value: 95}, {time: at(5), value: 90}, {time: at(0), value: 80},
    {time: at(10), value: null}, {time: at(5), value: 92},
    {time: 'bad', value: 10}, {time: at(45), value: 95},
    {time: at(50), value: '100'}, {time: at(55), value: -1}
  ]);
  assert.equal(points.length, 4);
  assert.deepEqual(points.map(p => p[1]), [80, 92, 95, 95]);
  const stats = summarize(points, 80);
  assert.equal(stats.current, 95);
  assert.equal(stats.peak, 95);
  assert.equal(stats.peakAt, Date.parse(at(40)));
  assert.equal(stats.longestHighSeconds, 5, '缺采区间不能算作连续高负载');
  assert.equal(stats.highSeconds, 10);
  assert.equal(stats.coveredSeconds, 10);
  assert.equal(stats.gaps, 1);
  assert.equal(chartPoints(points).filter(p => p[1] === null).length, 1);
  assert.equal(summarize([], 80).current, null);
  assert.equal(summarize([[1, 0]], 80).current, 0);
  assert.equal(summarize([[0, 90]], 80).longestHighSeconds, 0, '单个点不能推断持续时间');
  assert.equal(formatMetric(2048, false), '2.00 MiB/s');
  assert.equal(formatMetric(0, false), '0.00 KiB/s');
  assert.equal(formatMetric(null, true), '--');
  console.log('通过：监控数据归一化、缺采断线、持续时间、峰值及单位边界');
})().catch(error => { console.error(error); process.exitCode = 1; });
