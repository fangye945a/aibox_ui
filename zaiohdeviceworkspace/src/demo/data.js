/*
 * Copyright (c) 2026 Hunan OpenValley Digital Industry Development Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { strToU8, zipSync } from 'fflate';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { ReadSystemMetric } from './system-monitor';
import { demoOta } from './ota';
import { demoVideoFrames, demoVideoRequest, demoVideoWorkspace } from './video';

export const demoEnabled = process.env.VUE_APP_PAGES_DEMO === 'true';

const DEMO_USER = 'demo';
const DEMO_PASSWORD = 'Demo1234';
const DEMO_TOKEN = 'workspace-pages-demo';
const PASSWORD_KEY = 'zaioh-workspace:demo-password';
const unavailable = '该功能需要连接真实 CT23/CT21B 设备';
let bootTime = Date.now() - 297120000;
let logPath = '/data/log/demo';
let alertsCleared = false;

const logLines = [
  '[INFO] workspace: CT23 console service ready',
  '[INFO] net: eth0 link is up speed 1000Mbps',
  '[INFO] camera: USB video input enumerated',
  '[INFO] inference: person model loaded on RK NPU',
  '[DEBUG] monitor: CPU, memory, NPU and temperature sampled',
  '[INFO] system: heartbeat received from device service',
];

const ok = data => ({ code: 0, msg: 'success', data });
const error = (msg, code = 1) => ({ code, msg });

const passwordDigest = password => bytesToHex(sha256(utf8ToBytes(password)));
function matchesPassword(password) {
  if (typeof password !== 'string') return false;
  const digest = sessionStorage.getItem(PASSWORD_KEY);
  return digest ? passwordDigest(password) === digest : password === DEMO_PASSWORD;
}
export function resetDemoPassword() {
  sessionStorage.removeItem(PASSWORD_KEY);
}

function runningStatus() {
  const phase = Date.now() / 8000;
  const memory = Number((3.18 + Math.sin(phase) * 0.22).toFixed(2));
  return {
    boot_time: Math.floor((Date.now() - bootTime) / 1000),
    cpu_usage: Math.round(38 + Math.sin(phase * 1.2) * 8),
    cpu_temperature: Math.round(54 + Math.sin(phase * 0.55) * 3),
    memory,
    memory_used: Math.round(memory / 4 * 100),
  };
}

function systemInfo() {
  const status = runningStatus();
  return {
    ...status,
    device_info: {
      product_model: 'CT23',
      device_id: 'DEMO-CT23-0001',
      system_version: 'OpenHarmony 6.1',
      memory_type: 'LPDDR4X',
      storage: 128,
      storage_expansion: '--',
      compute_power: 6,
    },
    memory_info: { memory: 4, memory_used: status.memory, rate: status.memory_used },
    storage_info: { storage: 128, storage_used: 38.6, storage_can_used: 71.2, storage_system_used: 18.2 },
    storage_expansion_info: null,
    network_info: [
      { type: 'ethernet', status: 1, interface: 'eth0', IP: '192.0.2.23', subnet_mask: '255.255.255.0', gateway: '192.0.2.1', DNS: '192.0.2.53' },
      { type: 'ethernet', status: 1, interface: 'eth1', IP: '192.0.2.24', subnet_mask: '255.255.255.0', gateway: '--', DNS: '--' },
    ],
  };
}

function monitoringSample() {
  const keys = ['cpu_usage', 'memory_used', 'npu_usage', 'temperature', 'uplink_network',
    'downstream_network', 'disk_read_rate', 'disk_write_rate'];
  const now = Date.now();
  return {
    time: new Date(now).toISOString(),
    values: Object.fromEntries(keys.map(key => [key, ReadSystemMetric(key, now)])),
  };
}

function monitoringAlerts() {
  const now = Date.now();
  const records = [
    {
      id: `alert-cpu-${now}`, source: 'CPU', level: 'warning', active: true,
      message: 'CPU 使用率连续 30 秒超过 85%', timestamp: now - 52000, resolvedAt: null,
    },
    {
      id: `alert-temp-${now - 3600000}`, source: '温度', level: 'warning', active: false,
      message: '芯片温度超过 80 °C，当前已恢复', timestamp: now - 3720000, resolvedAt: now - 3580000,
    },
    {
      id: `alert-net-${now - 7200000}`, source: '网络', level: 'error', active: false,
      message: 'eth1 网络连接中断，当前已恢复', timestamp: now - 7310000, resolvedAt: now - 7210000,
    },
  ].filter(record => !alertsCleared || record.active);
  const active = records.filter(record => record.active).length;
  return {
    records, total: records.length,
    status: active ? { level: 'warning', message: `当前有 ${active} 条活动告警，请及时处理` } : { level: 'normal', message: '当前没有活动告警' },
  };
}

function logFiles({ page = 1, limit = 10, log_dir: dir = logPath }) {
  const names = dir === logPath ? ['services', 'system.log', 'kernel.log', 'network.log'] : ['service.log'];
  const files = names.map(name => ({
    name, path: dir, type: name.includes('.') ? 'file' : 'folder',
    suffix: name.includes('.') ? '.log' : '', last_modified: '2026-11-26 10:30:00',
  }));
  return { files: files.slice((page - 1) * limit, page * limit), pagination: { total: files.length } };
}

function downloadLogs(files = []) {
  const sample = logLines.join('\n');
  if (files.length === 1 && files[0].type === 'file') {
    return new Blob([sample], { type: 'text/plain' });
  }
  const entries = Object.fromEntries(files.map(({ name, type }, index) => {
    const safeName = name.replace(/[^\w.-]/g, '_');
    const path = type === 'folder' ? `${index + 1}-${safeName}/service.log` : `${index + 1}-${safeName}`;
    return [path, strToU8(sample)];
  }));
  return new Blob([zipSync(entries)], { type: 'application/zip' });
}

function wrapAxios(config, payload) {
  return { data: payload, status: 200, statusText: 'OK', headers: {}, config };
}

/** @brief 演示接口适配器，仅在 VUE_APP_PAGES_DEMO=true 时挂载。 */
export async function demoAdapter(config) {
  const url = new URL(config.url, window.location.origin);
  const path = url.pathname.replace(/^\/api\//, '');
  const method = (config.method || 'GET').toUpperCase();
  let data;
  if (typeof config.data === 'string' && /^\{|^\[/.test(config.data)) {
    try { data = JSON.parse(config.data); } catch { data = config.data; }
  } else {
    data = config.data;
  }
  const body = data && typeof data === 'object' && !(data instanceof Blob) && !(data instanceof File) ? data : {};

  if (path.startsWith('video/')) {
    return wrapAxios(config, await demoVideoRequest(path.slice(6) + url.search, method, data, config));
  }

  switch (path) {
    case 'login':
      data = body.user_name === DEMO_USER && matchesPassword(body.password) ?
        ok({ token: DEMO_TOKEN }) : error('演示账号或密码不正确');
      break;
    case 'logout':
      data = ok(true);
      break;
    case 'auth/status':
      data = { isLoggedIn: true };
      break;
    case 'system/info':
      data = ok(systemInfo());
      break;
    case 'system/restart':
      bootTime = Date.now();
      data = ok(true);
      break;
    case 'monitoring/alerts':
      if (method === 'DELETE') {
        alertsCleared = true;
        data = ok(true);
      } else {
        data = ok(monitoringAlerts());
      }
      break;
    case 'logs/getConfig':
      data = ok({ log_path: logPath });
      break;
    case 'logs/setConfig':
      logPath = body.log_path || logPath;
      data = ok(true);
      break;
    case 'logs/list':
      data = ok(logFiles(body));
      break;
    case 'logs/view':
      data = ok({ content: logLines.join('\n') });
      break;
    case 'logs/download':
      return { data: downloadLogs(body.list), status: 200, statusText: 'OK', headers: {}, config };
    case 'logs/export_realtime':
      return { data: new Blob([logLines.join('\n')], { type: 'text/plain' }), status: 200, statusText: 'OK', headers: {}, config };
    case 'remote/vnc/config':
      data = ok({ server: '192.0.2.23', port: 5900 });
      break;
    case 'remote/connect':
      await new Promise(resolve => setTimeout(resolve, 350));
      data = ok({ connection_id: 'pages-vnc', url: new URL('./remote-desktop/index.html', window.location.href).href });
      break;
    case 'remote/disconnect':
    case 'remote/ping':
      data = ok(true);
      break;
    case 'password/verify':
      data = matchesPassword(body.current_password) ? ok(true) : error('当前演示密码不正确');
      break;
    case 'password/change':
      if (!matchesPassword(body.current_password)) data = error('当前演示密码不正确');
      else if (typeof body.new_password !== 'string' || body.new_password.length < 8 || body.new_password.length > 20) data = error('新密码须为 8 至 20 位');
      else if (body.new_password === body.current_password) data = error('新密码须与当前密码不同');
      else {
        sessionStorage.setItem(PASSWORD_KEY, passwordDigest(body.new_password));
        data = ok(true);
      }
      break;
    case 'sse/disconnect':
    case 'logs/dmesg':
    case 'logs/hilog':
      data = ok(true);
      break;
    default:
      data = error(unavailable);
  }
  return wrapAxios(config, data);
}

/** @brief 支持少数直接 fetch 的鉴权与 OTA 接口。 */
export async function demoFetch(path, options = {}) {
  options.signal?.throwIfAborted();
  const authorized = options.headers?.Authorization === `Bearer ${DEMO_TOKEN}`;
  if (path.startsWith('/api/ota/')) {
    return authorized ? demoOta(path.slice('/api/ota'.length), options) : Response.json({}, { status: 401 });
  }
  if (path === '/api/auth/status') {
    return Response.json({ isLoggedIn: authorized });
  }
  if (path === '/api/system/info') {
    return authorized ? Response.json(ok(systemInfo())) : Response.json({}, { status: 401 });
  }
  return Response.json({ error: unavailable }, { status: 403 });
}

/** @brief 替代设备 SSE，在 Pages 中持续推送监控、日志、视频和运行状态。 */
export class DemoEventSource {
  constructor(url) {
    this.closed = false;
    const parsed = new URL(url, window.location.href);
    const path = parsed.pathname;
    const search = parsed.searchParams.get('search_text') || '';
    const ignoreCase = parsed.searchParams.get('ignore_case') === 'true';
    const regex = search && parsed.searchParams.get('use_regex') === 'true' ? new RegExp(search, ignoreCase ? 'i' : '') : null;
    const matches = line => regex ? regex.test(line) : ignoreCase ? line.toLowerCase().includes(search.toLowerCase()) : line.includes(search);
    this.start = setTimeout(() => {
      if (this.closed) return;
      this.onopen?.();
      const emit = () => {
        if (this.closed) return;
        if (path === '/api/monitoring/stream') {
          this.onmessage?.({ data: JSON.stringify([monitoringSample()]) });
        } else if (path === '/api/video/events') {
          this.onmessage?.({ data: JSON.stringify({ workspace: demoVideoWorkspace(), frames: demoVideoFrames() }) });
        } else if (parsed.searchParams.get('type') === 'runningStatus') {
          this.onmessage?.({ data: JSON.stringify(runningStatus()) });
        } else if (path === '/api/sse/connect') {
          const type = parsed.searchParams.get('type');
          if (type === 'dmesg' || type === 'hilog') {
            const lines = type === 'dmesg' ? ['[    0.000000] Booting Linux on physical CPU 0x0', ...logLines] : logLines;
            this.onmessage?.({ data: lines.filter(matches).join('\n') });
          } else {
            const line = `${new Date().toISOString()} ${logLines[tickCounter++ % logLines.length]}`;
            if (matches(line)) this.onmessage?.({ data: line });
          }
        }
      };
      emit();
      this.timer = setInterval(emit, 1000);
    }, 0);
  }
  close() {
    this.closed = true;
    clearTimeout(this.start);
    clearInterval(this.timer);
  }
}

let tickCounter = 0;
