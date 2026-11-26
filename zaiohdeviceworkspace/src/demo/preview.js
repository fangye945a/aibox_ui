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

import { demoVideoFrames, demoVideoScene } from './video';

const BOUNDARY = 'aibox-demo-frame';
const FRAME_INTERVAL_MS = 280;
const g_encoder = new TextEncoder();

function CreateScene(channelId) {
    const image = new Image();
    image.src = demoVideoScene({ id: channelId });
    return image.decode().then(() => image);
}

function DrawDetection(context, detection) {
    const [left, top, right, bottom] = detection.box;
    const color = detection.class === 'person' ? '#3af4b8' : '#ffd269';
    const text = `${detection.class} ${(detection.confidence * 100).toFixed(1)}%`;
    const labelWidth = Math.min(context.canvas.width - left - 1, Math.ceil(context.measureText(text).width) + 14);
    const labelTop = Math.max(1, top - 23);
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.strokeRect(left, top, right - left, bottom - top);
    context.fillStyle = 'rgba(12, 19, 28, .90)';
    context.beginPath();
    context.roundRect(left, labelTop, labelWidth, 22, 5);
    context.fill();
    context.lineWidth = 1;
    context.stroke();
    context.fillStyle = '#f7fafc';
    context.fillText(text, left + 7, labelTop + 15, Math.max(1, labelWidth - 14));
}

async function EncodeFrame(canvas, scene, frame) {
    canvas.width = frame.width;
    canvas.height = frame.height;
    const context = canvas.getContext('2d');
    context.drawImage(scene, 0, 0, canvas.width, canvas.height);
    context.font = '600 13px sans-serif';
    for (const detection of frame.detections) {
        DrawDetection(context, detection);
    }
    const jpeg = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!jpeg) {
        throw new Error('模拟预览编码失败');
    }
    return new Uint8Array(await jpeg.arrayBuffer());
}

function AppendPart(controller, id, frame, jpeg) {
    const headers = g_encoder.encode([
        `--${BOUNDARY}`,
        'Content-Type: image/jpeg',
        `Content-Length: ${jpeg.length}`,
        `X-Frame-Channel: ${id}`,
        `X-Frame-Sequence: ${frame.sequence}`,
        '', '',
    ].join('\r\n'));
    const part = new Uint8Array(headers.length + jpeg.length + 2);
    part.set(headers);
    part.set(jpeg, headers.length);
    part.set([13, 10], headers.length + jpeg.length);
    controller.enqueue(part);
}

/** @brief 在浏览器内生成与设备预览接口同格式的 JPEG 流。 */
export function OpenDemoPreview(path, { signal } = {}) {
    const query = new URL(path, window.location.href).searchParams;
    const channels = [...new Set(query.get('channels')?.split(',').filter(id => /^[a-z0-9-]+$/i.test(id)))].slice(0, 4);
    if (!channels.length) {
        return Response.json({ error: '请选择预览通道' }, { status: 400 });
    }
    signal?.throwIfAborted();
    const canvas = document.createElement('canvas');
    const scenes = new Map();
    let cancelled = false;
    let nextBatch = 0;
    let timer;
    let releaseWait;

    const stream = new ReadableStream({
        async pull(controller) {
            const delay = nextBatch - Date.now();
            if (delay > 0) {
                await new Promise(resolve => {
                    releaseWait = resolve;
                    timer = setTimeout(resolve, delay);
                });
                releaseWait = undefined;
            }
            if (cancelled || signal?.aborted) {
                return;
            }
            nextBatch = Date.now() + FRAME_INTERVAL_MS;
            const frames = demoVideoFrames();
            for (const id of channels) {
                const frame = frames[id];
                if (frame) {
                    if (!scenes.has(id)) {
                        scenes.set(id, await CreateScene(id));
                    }
                    const jpeg = await EncodeFrame(canvas, scenes.get(id), frame);
                    if (cancelled || signal?.aborted) {
                        return;
                    }
                    AppendPart(controller, id, frame, jpeg);
                }
            }
        },
        cancel() {
            cancelled = true;
            clearTimeout(timer);
            releaseWait?.();
        },
    });
    return new Response(stream, { headers: { 'Content-Type': `multipart/x-mixed-replace; boundary=${BOUNDARY}` } });
}
