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

let bootTime = Date.now() - 297120000;
let logPath = '/data/log/demo';

const logLines = [
  '[INFO] system: demo services started',
  '[INFO] net: eth0 link is up',
  '[DEBUG] monitor: collected CPU and memory metrics',
  '[INFO] system: heartbeat received'
];

function runningStatus() {
  const phase = Date.now() / 6000;
  const memory = Number((3.42 + Math.sin(phase) * 0.18).toFixed(2));
  return {
    boot_time: Math.floor((Date.now() - bootTime) / 1000),
    cpu_usage: Math.round(37 + Math.sin(phase * 1.3) * 9),
    cpu_temperature: Math.round(52 + Math.sin(phase * 0.5) * 3),
    memory,
    memory_used: Math.round(memory / 8 * 100)
  };
}

function systemInfo() {
  const status = runningStatus();
  return {
    ...status,
    device_info: {
      product_model: 'CT21B', device_id: 'DEMO-CT21B-0042',
      system_version: 'OpenHarmony 6.1', memory_type: 'LPDDR4X',
      storage: 128, storage_expansion: '--', compute_power: 6
    },
    memory_info: { memory: 8, memory_used: status.memory, rate: status.memory_used },
    storage_info: { storage: 128, storage_used: 38.6, storage_can_used: 71.2, storage_system_used: 18.2 },
    storage_expansion_info: null,
    network_info: [
      { type: 'ethernet', status: 1, interface: 'eth0', IP: '192.0.2.26', subnet_mask: '255.255.255.0', gateway: '192.0.2.1', DNS: '192.0.2.53' },
      { type: 'ethernet', status: 0, interface: 'eth1', IP: '--', subnet_mask: '--', gateway: '--', DNS: '--' }
    ]
  };
}

function monitoringData({ start_time: start, end_time: end, type }) {
  const endTime = Math.min(Date.parse(end), Date.now());
  const startTime = Math.max(Date.parse(start), endTime - 24 * 3600000);
  const bases = { cpu_usage: 37, cpu_temperature: 52, memory_used: 43, uplink_network: 820, downstream_network: 1450, disk_read_rate: 210, disk_write_rate: 95 };
  const base = bases[type] ?? 30;
  const points = [];
  for (let time = Math.ceil(startTime / 5000) * 5000; time <= endTime; time += 5000) {
    const wave = 1 + 0.21 * Math.sin(time / 73000) + 0.12 * Math.sin(time / 23000);
    points.push({ time: new Date(time).toISOString(), value: Number((base * wave).toFixed(2)) });
  }
  return { [type]: points };
}

function logFiles({ page = 1, limit = 10, log_dir: dir = logPath }) {
  const names = dir === logPath ? ['services', 'system.log', 'kernel.log', 'network.log'] : ['service.log'];
  const files = names.map(name => ({
    name, path: dir, type: name.includes('.') ? 'file' : 'folder',
    suffix: name.includes('.') ? '.log' : '', last_modified: '2026-11-18 10:30:00'
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

const DEMO_USER = 'demo';
const DEMO_PASSWORD = 'Demo1234';
const demoToken = 'workspace-demo';
const unavailable = '演示站点未连接真实设备';
const ok = data => ({ code: 0, msg: 'success', data });
const error = msg => ({ code: 1, msg });

export async function demoAdapter(config) {
  const path = new URL(config.url, window.location.origin).pathname;
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {};
  let data;
  switch (path) {
    case '/api/login':
      data = body.user_name === DEMO_USER && body.password === DEMO_PASSWORD ? ok({ token: demoToken }) : error('请使用演示账号 demo / Demo1234');
      break;
    case '/api/system/info':
      data = ok(systemInfo());
      break;
    case '/api/system/restart':
      bootTime = Date.now();
      data = ok(true);
      break;
    case '/api/monitoring/data':
      data = ok(monitoringData(config.params || {}));
      break;
    case '/api/logs/getConfig':
      data = ok({ log_path: logPath });
      break;
    case '/api/logs/setConfig':
      logPath = body.log_path || logPath;
      data = ok(true);
      break;
    case '/api/logs/list':
      data = ok(logFiles(body));
      break;
    case '/api/logs/view':
      data = ok({ content: logLines.join('\n') });
      break;
    case '/api/logs/download':
      data = downloadLogs(body.list);
      break;
    case '/api/logs/export_realtime':
      data = new Blob([logLines.join('\n')], { type: 'text/plain' });
      break;
    case '/api/remote/vnc/config':
      data = ok({ server: '192.0.2.26', port: 5900 });
      break;
    case '/api/logout':
    case '/api/password/verify':
    case '/api/logs/dmesg':
    case '/api/logs/hilog':
    case '/api/sse/disconnect':
      data = ok(true);
      break;
    default:
      data = error(unavailable);
      break;
  }
  return { data, status: 200, statusText: 'OK', headers: {}, config };
}

export async function demoFetch(path, options) {
  options?.signal?.throwIfAborted();
  const authorized = options?.headers?.Authorization === `Bearer ${demoToken}`;
  switch (path) {
    case '/api/auth/status':
      return Response.json({ isLoggedIn: authorized });
    case '/api/system/info':
      return authorized ? Response.json(ok(systemInfo())) : Response.json({}, { status: 401 });
    case '/api/ota/uploads':
      if (!options?.method || options.method === 'GET') {
        return Response.json({ uploads: [] });
      }
      break;
    default:
      break;
  }
  return Response.json({ error: unavailable }, { status: 403 });
}

export class DemoEventSource {
  constructor(url) {
    const params = new URL(url).searchParams;
    const type = params.get('type');
    const search = params.get('search_text') || '';
    const ignoreCase = params.get('ignore_case') === 'true';
    const regex = search && params.get('use_regex') === 'true' ? new RegExp(search, ignoreCase ? 'i' : '') : null;
    const matches = line => {
      if (regex) {
        return regex.test(line);
      }
      return ignoreCase ? line.toLowerCase().includes(search.toLowerCase()) : line.includes(search);
    };
    this.start = setTimeout(() => {
      this.onopen?.();
      if (type === 'dmesg') {
        this.onmessage?.({ data: logLines.filter(matches).join('\n') });
        return;
      }
      let index = 0;
      const emit = () => {
        if (type === 'runningStatus') {
          this.onmessage?.({ data: JSON.stringify(runningStatus()) });
          return;
        }
        const line = `${new Date().toISOString()} ${logLines[index % logLines.length]}`;
        index += 1;
        if (matches(line)) {
          this.onmessage?.({ data: line });
        }
      };
      emit();
      this.timer = setInterval(emit, 1000);
    }, 0);
  }

  close() {
    clearTimeout(this.start);
    clearInterval(this.timer);
  }
}
