// 覆盖会话失效、网络异常、迟到响应及页面卸载，避免心跳误退新会话。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/utils/session-watch.js'), 'utf8');
  const { startSessionWatch } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const intervals = new Map();
  const timeouts = new Map();
  let timerId = 0;
  global.setInterval = fn => { intervals.set(++timerId, fn); return timerId; };
  global.clearInterval = id => intervals.delete(id);
  global.setTimeout = fn => { timeouts.set(++timerId, fn); return timerId; };
  global.clearTimeout = id => timeouts.delete(id);
  global.window = new EventTarget();
  global.document = new EventTarget();
  document.hidden = false;
  const values = new Map();
  global.localStorage = { getItem: key => values.get(key) ?? null };
  let requests = [];
  global.fetch = (url, options) => new Promise((resolve, reject) => requests.push({url, options, resolve, reject}));
  const flush = () => new Promise(resolve => setImmediate(resolve));
  let exits = 0;
  function start() {
    values.set('loginToken', 'old');
    requests = [];
    return startSessionWatch(() => exits++);
  }
  let stop = start();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.headers.Authorization, 'Bearer old');
  assert.equal(requests[0].options.cache, 'no-store');
  requests[0].resolve({status: 503}); await flush();
  assert.equal(exits, 0, '服务异常不能退出');
  [...intervals.values()][0]();
  requests[1].reject(new Error('offline')); await flush();
  assert.equal(exits, 0, '网络异常不能退出');
  window.dispatchEvent(new Event('online'));
  requests[2].resolve({status: 401}); await flush();
  assert.equal(exits, 1);
  assert.equal(intervals.size, 0);
  stop();

  stop = start();
  values.set('loginToken', 'new');
  requests[0].resolve({status: 401}); await flush();
  assert.equal(exits, 1, '旧请求401不能误退新令牌');
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(requests[1].options.headers.Authorization, 'Bearer new');
  const signal = requests[1].options.signal;
  stop();
  assert.equal(signal.aborted, true);
  requests[1].resolve({status: 401}); await flush();
  assert.equal(exits, 1, '卸载后不再跳转');
  const count = requests.length;
  window.dispatchEvent(new Event('online'));
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(requests.length, count, '卸载后移除事件监听');
  assert.equal(timeouts.size, 0);
  assert.equal(intervals.size, 0);

  stop = start();
  [...intervals.values()][0]();
  assert.equal(requests.length, 1, '请求不重叠');
  [...timeouts.values()][0]();
  assert.equal(requests[0].options.signal.aborted, true, '超时中止请求');
  requests[0].reject(new Error('aborted')); await flush();
  assert.equal(exits, 1);
  values.delete('loginToken');
  const event = new Event('storage');
  event.key = 'loginToken';
  window.dispatchEvent(event);
  assert.equal(exits, 2, '跨标签页注销及时退出');
  stop();
  assert.equal(intervals.size, 0);
  assert.equal(timeouts.size, 0);
  console.log('通过：会话401退出、网络异常保留、旧响应隔离、请求超时/不重叠、事件恢复与卸载清理');
})().catch(error => { console.error(error); process.exitCode = 1; });
