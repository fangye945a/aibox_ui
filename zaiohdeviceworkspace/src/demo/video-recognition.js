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

export function IsDemoRtspAddress(value) {
    try {
        const url = new URL(value);
        return /^rtsp:\/\//i.test(value) && url.protocol === 'rtsp:' && Boolean(url.hostname) && !url.username &&
            !url.password && !url.hash && !/\s/.test(value) && (!url.port || Number(url.port) > 0);
    } catch {
        return false;
    }
}

function Overlap(first, second) {
    const width = Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x);
    const height = Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y);
    const area = Math.max(0, width) * Math.max(0, height);
    return area / (first.width * first.height + second.width * second.height - area);
}

function SelectDetections(candidates, settings) {
    const qualified = candidates.filter(item => item.score >= settings.confidence).sort((first, second) => second.score - first.score);
    if (settings.channelId !== 'person') {
        return qualified;
    }
    const selected = [];
    for (const item of qualified) {
        if (!selected.some(existing => Overlap(existing, item) > settings.nmsIou)) {
            selected.push(item);
        }
    }
    return selected;
}

function DrawPerson(context, person) {
    const { x, y } = person;
    context.fillStyle = '#9daab2';
    context.fillRect(x + 10, y + 75, 12, 57);
    context.fillRect(x + 30, y + 75, 12, 57);
    context.fillStyle = '#cf9763';
    context.fillRect(x + 5, y + 32, 8, 53);
    context.fillRect(x + 38, y + 32, 8, 53);
    context.beginPath();
    context.arc(x + 26, y + 17, 12, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = person.helmet ? '#d79b3c' : '#6a9aa5';
    context.fillRect(x + 13, y + 31, 25, 51);
    if (person.helmet) {
        context.fillStyle = '#e8b94c';
        context.beginPath();
        context.arc(x + 26, y + 12, 14, Math.PI, 0);
        context.fill();
        context.fillRect(x + 10, y + 12, 32, 4);
    }
}

function DrawDetection(context, item) {
    const color = item.kind === 'hat' ? '#f2ca66' : '#69e0a9';
    const text = `${item.kind === 'hat' ? '安全帽' : '人员'} ${Math.round(item.score * 100)}%`;
    const labelX = item.kind === 'hat' ? item.x + item.width + 4 : item.x - 1;
    const labelY = item.kind === 'hat' ? item.y + 2 : item.y - 17;
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.strokeRect(item.x, item.y, item.width, item.height);
    context.fillStyle = color;
    context.font = '12px sans-serif';
    context.fillRect(labelX, labelY, context.measureText(text).width + 10, 16);
    context.fillStyle = '#17232c';
    context.fillText(text, labelX + 5, labelY + 12);
}

/** @brief 绘制独立的示例帧，并按通道参数筛选模拟检测框。 */
export function DrawModelSample(context, elapsed, settings) {
    const first = { x: 210 + Math.sin(elapsed / 2100) * 68, y: 113, width: 52, height: 134, score: 0.94, kind: 'person', helmet: true };
    const second = { x: 387 + Math.sin(elapsed / 1740) * 53, y: 127, width: 52, height: 134, score: 0.78, kind: 'person', helmet: false };
    context.fillStyle = '#26343f';
    context.fillRect(0, 0, 640, 360);
    context.fillStyle = '#364752';
    context.fillRect(0, 100, 640, 174);
    context.fillStyle = '#dbae52';
    context.fillRect(0, 98, 640, 3);
    context.fillRect(0, 274, 640, 3);
    DrawPerson(context, first);
    DrawPerson(context, second);
    const candidates = [first, second];
    if (settings.channelId === 'person') {
        candidates.push({ ...first, x: first.x + 8, y: first.y + 7, score: 0.66 });
    } else {
        candidates.push({ x: first.x + 9, y: first.y - 2, width: 34, height: 21, score: 0.88, kind: 'hat' });
    }
    const detections = SelectDetections(candidates, settings);
    if (settings.showBox) {
        detections.forEach(item => DrawDetection(context, item));
    }
    const hat = detections.filter(item => item.kind === 'hat').length;
    return { person: detections.length - hat, hat };
}
