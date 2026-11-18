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

const STATE_KEY = 'zaioh-workspace:demo-ota';
const CHUNK_SIZE = 256 * 1024;
const MAX_FILE_SIZE = 128 * 1024 * 1024;
const CHECK_MS = 1400;
const VALIDATING_MS = 2200;
const REBOOT_MS = 4400;
const FINISH_MS = 6600;
export const DEMO_FIRMWARE_NAME = 'zaioh-demo-6.1.zip';

/** @brief 生成便于观察分片进度的模拟升级包。 */
export function createDemoFirmware() {
  const archive = zipSync({ 'README.txt': strToU8('ZAIOH demo firmware'), 'demo.bin': new Uint8Array(1024 * 1024) }, { level: 0 });
  return new File([archive], DEMO_FIRMWARE_NAME, { type: 'application/zip' });
}

function reply(data, status = 200) {
  return Response.json(data, { status });
}

function loadState() {
  const state = JSON.parse(sessionStorage.getItem(STATE_KEY) || '{}');
  const upload = state.upload;
  const job = state.job;
  if (upload?.status === 'checking' && Date.now() >= upload.readyAt) {
    upload.status = 'ready';
  }
  if (job) {
    const elapsed = Date.now() - job.startedAt;
    if (elapsed >= FINISH_MS) {
      job.status = 'succeeded';
      upload.status = 'consumed';
    } else if (elapsed >= REBOOT_MS) {
      job.status = 'verifying';
    } else if (elapsed >= VALIDATING_MS) {
      job.status = 'reboot_pending';
    }
  }
  return state;
}

function saveReply(state, data) {
  sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
  return reply(data);
}

/** @brief 在浏览器内模拟 OTA，只保存任务编号、进度和状态。 */
export async function demoOta(path, { method = 'GET', body, headers, signal }) {
  if (method === 'PUT') {
    await new Promise(resolve => setTimeout(resolve, 220));
    signal?.throwIfAborted();
  }
  const state = loadState();
  const upload = state.upload;
  const job = state.job;
  if (path === '/uploads' && method === 'GET') {
    return reply({ uploads: upload && upload.status !== 'consumed' ? [upload] : [] });
  }
  if (path === '/uploads' && method === 'POST') {
    const { fileName, size } = JSON.parse(body || '{}');
    if (upload && upload.status !== 'consumed') {
      return reply({ error: '已有模拟上传任务' }, 409);
    }
    if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_FILE_SIZE || !fileName?.toLowerCase().endsWith('.zip')) {
      return reply({ error: '请选择 128 MiB 以内的非空 ZIP 文件' }, 400);
    }
    state.upload = { id: crypto.randomUUID(), fileName, size, chunkSize: CHUNK_SIZE, offset: 0, status: 'uploading' };
    state.job = null;
    return saveReply(state, state.upload);
  }
  if (job && path === `/jobs/${job.id}` && method === 'GET') {
    return saveReply(state, job);
  }
  if (!upload || upload.status === 'consumed') {
    return reply({ error: '没有找到模拟上传任务' }, 404);
  }
  const uploadPath = `/uploads/${upload.id}`;
  if (path === uploadPath && method === 'GET') {
    return reply(upload);
  }
  if (path === uploadPath && method === 'PUT') {
    const offset = headers?.['Upload-Offset'];
    if (upload.status !== 'uploading' || offset !== String(upload.offset) || !(body instanceof Blob) ||
        body.size <= 0 || body.size > Math.min(CHUNK_SIZE, upload.size - upload.offset)) {
      return reply({ error: '模拟上传分片或偏移不正确' }, 409);
    }
    upload.offset += body.size;
    return saveReply(state, upload);
  }
  if (path === uploadPath && method === 'DELETE' && ['uploading', 'ready'].includes(upload.status)) {
    return saveReply({}, {});
  }
  if (path === `${uploadPath}/complete` && method === 'POST') {
    const { sha256 } = JSON.parse(body || '{}');
    if (upload.status !== 'uploading' || upload.offset !== upload.size || typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)) {
      return reply({ error: '模拟上传未完成或文件摘要无效' }, 409);
    }
    upload.status = 'checking';
    upload.readyAt = Date.now() + CHECK_MS;
    return saveReply(state, upload);
  }
  if (path === '/execute' && method === 'POST' && upload.status === 'ready' && JSON.parse(body || '{}').uploadId === upload.id) {
    upload.status = 'executing';
    state.job = { id: upload.id, status: 'validating', startedAt: Date.now() };
    return saveReply(state, state.job);
  }
  return reply({ error: '模拟任务无法执行当前操作' }, 409);
}
