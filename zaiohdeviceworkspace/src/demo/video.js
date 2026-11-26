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

const STORAGE_KEY = 'zaioh-pages-video-v1';
const STARTED_AT = Date.now() - 125000;
let tick = 0;
let workspace;

function initialWorkspace() {
  return {
    channels: [
      {
        id: 'channel-office-2k', name: '办公室 2K', location: '办公室',
        kind: 'rtsp', source: 'rtsp://192.0.2.41:554/main',
        models: [{ id: 'person-v1', confidence: 0.35, nms: 0.45 }],
      },
      {
        id: 'channel-gate', name: '人员检测', location: '园区入口',
        kind: 'mp4', source: 'demo-gate', models: [{ id: 'person-v1', confidence: 0.25, nms: 0.45 }],
      },
      {
        id: 'channel-usb-a', name: '办公室 USB', location: '设备正面',
        kind: 'usb', source: '/dev/video0', models: [{ id: 'person-v1', confidence: 0.30, nms: 0.45 }],
      },
      {
        id: 'channel-hat', name: '安全帽识别', location: '安全作业现场',
        kind: 'hls', source: 'https://example.com/device-demo/index.m3u8',
        models: [{ id: 'safety-helmet-v1', confidence: 0.45, nms: 0.45 }],
      },
    ],
    models: [
      {
        id: 'person-v1', name: '人员检测', version: '1.2.0', kind: 'person',
        labels: ['person'], target: 'rk3588',
      },
      {
        id: 'safety-helmet-v1', name: '人员与安全帽检测', version: '1.1.0', kind: 'yolo26n',
        labels: ['person', 'helmet', 'no-helmet'], target: 'rk3588',
      },
    ],
    videos: [
      { id: 'demo-gate', name: '人员检测示例.mp4', size: 3686400 },
      { id: 'demo-helmet', name: '安全帽检测示例.mp4', size: 4194304 },
    ],
    cameras: [
      { name: 'USB Camera A', path: '/dev/video0' },
      { name: 'USB Camera B', path: '/dev/video2' },
    ],
    diagnostics: {},
  };
}

function loadWorkspace() {
  if (workspace) return workspace;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.channels?.length && saved?.models?.length) {
      workspace = saved;
    }
  } catch {
    workspace = null;
  }
  workspace ||= initialWorkspace();
  for (const channel of workspace.channels) {
    if (!workspace.diagnostics[channel.id]) workspace.diagnostics[channel.id] = {};
  }
  return workspace;
}

function saveWorkspace() {
  try {
    const saved = structuredClone(workspace);
    for (const diagnostic of Object.values(saved.diagnostics)) {
      delete diagnostic.previewFps;
      delete diagnostic.inferenceFps;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // The live demo can continue even when browser storage is unavailable.
  }
}

function updateDiagnostics() {
  const state = loadWorkspace();
  tick += 1;
  for (const [index, channel] of state.channels.entries()) {
    const current = state.diagnostics[channel.id] ||= {};
    const running = current.state === 'running';
    current.state ||= 'running';
    current.active = ['running', 'starting', 'reconnecting'].includes(current.state);
    current.previewFps = current.active ? 12 + (tick + index) % 4 / 3 : 0;
    current.inferenceFps = current.active ? 11.2 + ((tick * 3 + index * 7) % 24) / 10 : 0;
    current.newFrames = (current.newFrames || 0) + (current.active ? 12 : 0);
    current.droppedFrames = (current.droppedFrames || 0) + (current.active && tick % 4 === index % 4 ? 1 : 0);
    current.inferenceMs = 28 + index * 3;
    current.npuMs = 19 + index * 2;
    current.preprocessMs = 2.6 + index * 0.2;
    current.postprocessMs = 1.4 + index * 0.1;
    current.previewMs = 3.2;
    current.reconnects ||= 0;
    current.error = '';
    if (running && index === 3 && tick % 37 === 0) current.reconnects += 1;
  }
  return state;
}

function clone(value) {
  return structuredClone(value);
}

/** @brief 返回与真实视频分析接口结构一致的本地演示工作区。 */
export function demoVideoWorkspace() {
  updateDiagnostics();
  return clone(loadWorkspace());
}

export function demoVideoFrames() {
  const state = demoVideoWorkspace();
  const now = Date.now();
  const frames = {};
  for (const [index, channel] of state.channels.entries()) {
    const diagnostic = state.diagnostics[channel.id];
    if (!diagnostic.active) continue;
    const dx = Math.round((Math.sin(now / 2800 + index) + 1) * 18);
    const dy = Math.round((Math.cos(now / 3500 + index) + 1) * 5);
    const detections = [{
      class: 'person', confidence: 0.91 - index * 0.035, model: channel.models[0]?.id,
      box: [105 + dx + index * 22, 82 + dy, 292 + dx + index * 22, 326 + dy],
    }];
    if (index === 3) {
      detections.push({
        class: index % 2 ? 'no-helmet' : 'helmet', confidence: 0.86,
        model: channel.models[0]?.id, box: [342 + dx, 128 + dy, 446 + dx, 285 + dy],
      });
    }
    frames[channel.id] = {
      sequence: Math.floor((now - STARTED_AT) / 90),
      ptsMs: now - STARTED_AT,
      width: 640,
      height: 360,
      annotated: false,
      detections,
    };
  }
  return frames;
}

/** @brief 生成带设备场景的 SVG，供 Pages 版静态预览使用，不连接本机摄像头。 */
export function demoVideoScene(channel) {
  const palette = [
    ['#17324d', '#315d77'], ['#3e3230', '#8b6947'],
    ['#23363a', '#47726d'], ['#343447', '#745c76'],
  ][Math.max(0, loadWorkspace().channels.findIndex(item => item.id === channel.id)) % 4];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette[0]}"/><stop offset="1" stop-color="${palette[1]}"/></linearGradient></defs>
    <rect width="640" height="360" fill="url(#g)"/>
    <path d="M0 248 L88 180 L172 224 L268 144 L391 231 L496 155 L640 244 V360 H0Z" fill="#0f1e29" opacity=".62"/>
    <rect x="408" y="226" width="154" height="72" rx="5" fill="#1d2b35"/>
    <circle cx="485" cy="262" r="22" fill="#6fa7c4" opacity=".55"/>
    <rect x="0" y="318" width="640" height="42" fill="#071019" opacity=".72"/>
  </svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

let generatedRecords;
function records() {
  if (generatedRecords) return generatedRecords;
  const now = Date.now();
  generatedRecords = Array.from({ length: 12 }, (_, index) => {
    const channel = loadWorkspace().channels[index % loadWorkspace().channels.length];
    const model = channel.models[0].id;
    const capturedAt = new Date(now - index * 47000).toISOString();
    return {
      id: String(now - index * 47000), channel: channel.id, model,
      sequence: 8460 - index * 31, capturedAt,
      ptsMs: now - index * 47000, width: 640, height: 360, annotated: false,
      detections: [{
        class: 'person', confidence: 0.94 - index * 0.01, model,
        box: [124 + index * 7, 88, 304 + index * 7, 326],
      }],
    };
  });
  return generatedRecords;
}

function snapshotSvg(record) {
  const boxes = record.detections.map((item, index) => {
    const [x1, y1, x2, y2] = item.box;
    const color = item.class === 'no-helmet' ? '#ffbf47' : '#36e0b0';
    return `<g><rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" fill="none" stroke="${color}" stroke-width="4"/>
      <rect x="${x1}" y="${Math.max(0, y1 - 24)}" width="${Math.max(120, item.class.length * 11 + 66)}" height="24" fill="${color}"/>
      <text x="${x1 + 6}" y="${Math.max(18, y1 - 7)}" fill="#10212a" font-family="sans-serif" font-size="15">${item.class} ${(item.confidence * 100).toFixed(1)}%</text></g>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="g"><stop stop-color="#19334b"/><stop offset="1" stop-color="#7c6549"/></linearGradient></defs>
    <rect width="640" height="360" fill="url(#g)"/><path d="M0 274L102 188l96 63 95-103 115 99 100-73 132 114v72H0z" fill="#0b1924" opacity=".7"/>${boxes}
    <text x="18" y="342" fill="#d9e7f2" font-family="sans-serif" font-size="14">CT23 · AI 检测截图</text></svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

function ok(data) {
  return { code: 0, msg: 'success', data };
}

function fail(message) {
  return { code: 1, msg: message };
}

function findChannel(id) {
  return loadWorkspace().channels.find(channel => channel.id === id);
}

/** @brief 模拟真实 /api/video/* 接口，返回值继续经过工作台统一 Axios 拦截器。 */
export async function demoVideoRequest(path, method, data, config = {}) {
  const state = updateDiagnostics();
  if (path === 'workspace' && method === 'GET') return ok(clone(state));
  if (path === 'channels' && method === 'PUT') {
    const input = typeof data === 'string' ? JSON.parse(data) : data;
    if (!input?.name || !input.models?.length) return fail('通道名称和检测模型不能为空');
    let channel = state.channels.find(item => item.id === input.id);
    if (channel) Object.assign(channel, input);
    else {
      channel = { ...input, id: input.id || `channel-${Date.now().toString(36)}` };
      state.channels.push(channel);
      state.diagnostics[channel.id] = { state: 'stopped', active: false };
    }
    saveWorkspace();
    return ok(clone(channel));
  }
  let match = path.match(/^channels\/([^/]+)\/(start|stop)$/);
  if (match && method === 'POST') {
    const channel = findChannel(decodeURIComponent(match[1]));
    if (!channel) return fail('通道不存在');
    Object.assign(state.diagnostics[channel.id], {
      state: match[2] === 'start' ? 'running' : 'stopped',
      active: match[2] === 'start', error: '',
    });
    saveWorkspace();
    return ok(true);
  }
  match = path.match(/^channels\/([^/]+)$/);
  if (match && method === 'DELETE') {
    const id = decodeURIComponent(match[1]);
    state.channels = state.channels.filter(channel => channel.id !== id);
    delete state.diagnostics[id];
    saveWorkspace();
    return ok(true);
  }
  if (path.startsWith('uploads?') && method === 'POST') {
    const name = new URLSearchParams(path.split('?')[1]).get('name') || 'upload.mp4';
    const video = { id: `video-${Date.now().toString(36)}`, name, size: data?.size || 0 };
    state.videos.push(video);
    saveWorkspace();
    return ok(video);
  }
  if (path === 'models' && method === 'POST') {
    const model = {
      id: `model-${Date.now().toString(36)}`, name: '新导入设备模型', version: '1.0.0',
      kind: 'person', labels: ['person'], target: 'rk3588',
    };
    state.models.push(model);
    saveWorkspace();
    return ok(model);
  }
  match = path.match(/^models\/([^/]+)\/export$/);
  if (match && method === 'GET') {
    const model = state.models.find(item => item.id === decodeURIComponent(match[1]));
    if (!model) return fail('模型不存在');
    const archive = zipSync({
      'model.json': strToU8(JSON.stringify({ name: model.name, version: model.version, kind: model.kind, target: model.target, file: 'model.rknn' })),
      'model.rknn': new Uint8Array(4096),
    }, { level: 0 });
    return new Blob([archive], { type: 'application/zip' });
  }
  if (path.startsWith('records?') && method === 'GET') {
    const query = new URLSearchParams(path.split('?')[1]);
    const channel = query.get('channel');
    const model = query.get('model');
    return ok(records().filter(item => (!channel || item.channel === channel) && (!model || item.model === model)));
  }
  match = path.match(/^records\/([^/]+)\/preview$/);
  if (match && method === 'GET') {
    const record = records().find(item => item.id === decodeURIComponent(match[1]));
    if (!record) return fail('检测记录不存在');
    return snapshotSvg(record);
  }
  return fail('当前演示未提供该视频接口');
}
