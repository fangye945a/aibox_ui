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

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const headerTerminator = encoder.encode('\r\n\r\n');

function findHeaderEnd(buffer) {
  outer: for (let index = 0; index <= buffer.length - headerTerminator.length; index++) {
    for (let offset = 0; offset < headerTerminator.length; offset++) {
      if (buffer[index + offset] !== headerTerminator[offset]) continue outer;
    }
    return index;
  }
  return -1;
}

function parseHeaders(value) {
  const headers = {};
  for (const line of value.split('\r\n')) {
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
  }
  return headers;
}

/** @brief 增量解析复用预览响应，将每个 JPEG 部件交给调用方。 */
export function createPreviewMultipartParser(onPart) {
  let buffer = new Uint8Array(0);
  return {
    push(chunk) {
      if (!chunk?.length) return;
      const combined = new Uint8Array(buffer.length + chunk.length);
      combined.set(buffer);
      combined.set(chunk, buffer.length);
      buffer = combined;
      for (;;) {
        const headerEnd = findHeaderEnd(buffer);
        if (headerEnd < 0) return;
        const headers = parseHeaders(decoder.decode(buffer.subarray(0, headerEnd)));
        const length = Number(headers['content-length']);
        if (!Number.isSafeInteger(length) || length < 0) {
          buffer = buffer.subarray(headerEnd + headerTerminator.length);
          continue;
        }
        const bodyStart = headerEnd + headerTerminator.length;
        const bodyEnd = bodyStart + length;
        if (buffer.length < bodyEnd) return;
        const body = buffer.slice(bodyStart, bodyEnd);
        buffer = buffer.subarray(bodyEnd);
        if (buffer[0] === 13 && buffer[1] === 10) buffer = buffer.subarray(2);
        onPart(headers, body);
      }
    }
  };
}

export async function readPreviewMultipart(response, onPart, signal) {
  if (!response.body) throw new Error('浏览器不支持复用视频流');
  const reader = response.body.getReader();
  const abort = () => { void reader.cancel(); };
  signal.addEventListener('abort', abort, { once: true });
  const parser = createPreviewMultipartParser(onPart);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      parser.push(value);
    }
  } finally {
    signal.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}
