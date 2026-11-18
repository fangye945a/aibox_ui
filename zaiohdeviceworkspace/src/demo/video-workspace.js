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

import { markRaw, reactive } from 'vue';
import { storage } from './storage';
import { DetectionLabel, ModelDetections } from './video-recognition';

const CONFIG_KEY = 'video-workspace';
const SAMPLE_COUNT = 100;
const RECORD_LIMIT = 400;
const HOUR_MS = 3600000;

function ReadConfig(key) {
    try {
        return JSON.parse(storage.getItem(key)) ?? {};
    } catch {
        return {};
    }
}

function MakeChannel(id, name, modelId, saved) {
    const suffix = id === 'person' ? '' : ':safety';
    const camera = ReadConfig(`video-camera${suffix}`);
    const algorithm = ReadConfig(`video-algorithm${suffix}`);
    return {
        id, name, kind: id === 'person' ? 'person' : 'yolo26n', modelId, autostart: true, ...saved,
        source: {
            type: camera.source === 'local' ? 'usb' : camera.source === 'rtsp' ? 'rtsp' : 'mp4',
            sourceId: 'sample', loop: camera.loop ?? true, rtspUrl: camera.rtspUrl ?? '',
            cameraIndex: 0, realUsb: camera.source === 'local', deviceId: camera.deviceId ?? '',
            resolution: camera.resolution ?? '1280x720', fps: camera.fps ?? 25, ...saved?.source
        },
        algorithm: { mode: 'model', confidence: 0.25, nmsIou: 0.45, showBox: true,
            sensitivity: 60, minArea: 0.8, interval: 250, ...algorithm, ...saved?.algorithm },
        state: 'stopped', frame: null, fps: 0, error: '', session: 0
    };
}

/** @brief 返回该模拟模型支持的类别。 */
export function ModelLabels(kind) {
    return kind === 'person' ? ['person'] : ['person', 'hat'];
}

/** @brief 返回模拟单帧各阶段的处理耗时。 */
export function FrameTimings(id, sequence) {
    const inference = (id === 'person' ? 17 : 28) + sequence / 7 % 5;
    return { decode: 3.2, preprocess: 2.5, inference, postprocess: 1.1, jpeg: 2, pipeline: inference + 8.8 };
}

function MakeBaseline(id, name, kind) {
    return { id, name, kind, target: 'rk3588', sha256: null, status: '内置基线', labels: ModelLabels(kind) };
}

function SeedRecords(now) {
    return Array.from({ length: SAMPLE_COUNT }, (_, index) => {
        const channelId = index % 2 ? 'safety' : 'person';
        const elapsed = index * 1250;
        return {
            id: SAMPLE_COUNT - index, channelId, modelId: channelId === 'person' ? 'person-baseline' : 'yolo26n-baseline',
            sequence: SAMPLE_COUNT - index, createdAt: now - (index + 1) * 300000, elapsed,
            width: 640, height: 360, mode: 'model',
            detections: ModelDetections(elapsed, { channelId, confidence: 0.25, nmsIou: 0.45 }), timings: FrameTimings(channelId, index)
        };
    });
}

/** @brief 生成一次模拟板端指标采样；缺失的设备接口保留空读数。 */
export function MetricSample(timestamp) {
    const wave = Math.sin(timestamp / 12500);
    const make = (id, label, value, unit, details) => ({ id, label, value, unit, ...details });
    return { timestamp, metrics: [
        make('cpu', 'CPU 使用率', 48 + wave * 14, '%', { scope: '整板', source: '/proc/stat（模拟）', window: 2 }),
        make('memory', '内存使用率', 53 + wave * 3, '%', { scope: '整板', source: '/proc/meminfo（模拟）', window: 0 }),
        make('npu', 'NPU 使用率', 61 + wave * 12, '%', { scope: 'NPU 核心 0', source: '驱动计数（模拟）', window: 2 }),
        make('temperature', '芯片温度', 73 + wave * 2, '°C', { scope: 'SoC', source: '温度传感器（模拟）', window: 0 }),
        make('power', '板端功耗', null, 'W', { scope: '整板', source: '功耗传感器', window: null, reason: '演示环境没有功耗传感器' }),
        make('ethRx', '以太网接收速率', 8.8 + wave * 3, 'Mbps', { scope: 'eth0', source: '网卡字节计数（模拟）', window: 2 }),
        make('ethTx', '以太网发送速率', 1.6 + wave, 'Mbps', { scope: 'eth0', source: '网卡字节计数（模拟）', window: 2 }),
        make('ethLink', '以太网协商速率', 1000, 'Mbps', { scope: 'eth0', source: '链路协商（模拟）', window: 0 }),
        make('ethRxUsage', '以太网接收带宽占用', (8.8 + wave * 3) / 10, '%', { scope: 'eth0', source: '速率 / 协商容量（模拟）', window: 2 }),
        make('ethTxUsage', '以太网发送带宽占用', (1.6 + wave) / 10, '%', { scope: 'eth0', source: '速率 / 协商容量（模拟）', window: 2 }),
        make('wifiRx', 'Wi-Fi 接收速率', null, 'Mbps', { scope: 'wlan0', source: '网卡字节计数', window: null, reason: '模拟接口未连接' }),
        make('wifiTx', 'Wi-Fi 发送速率', null, 'Mbps', { scope: 'wlan0', source: '网卡字节计数', window: null, reason: '模拟接口未连接' })
    ] };
}

/** @brief 初始化通道配置、模型资产、历史记录和性能样本。 */
export function CreateVideoWorkspace() {
    const now = Date.now();
    const saved = ReadConfig(CONFIG_KEY);
    return reactive({
        channels: [MakeChannel('person', '人员检测', 'person-baseline', saved.person), MakeChannel('safety', '安全检测', 'yolo26n-baseline', saved.safety)],
        models: [MakeBaseline('person-baseline', 'Person', 'person'), MakeBaseline('yolo26n-baseline', 'YOLO26n', 'yolo26n'), ...(saved.models ?? [])],
        sources: [{ id: 'sample', name: '内置示例画面', size: null, createdAt: null }],
        records: SeedRecords(now), nextRecord: SAMPLE_COUNT + 1,
        metrics: Array.from({ length: 31 }, (_, index) => MetricSample(now - (30 - index) * 2000)),
        timings: ['person', 'safety'].map(id => Array.from({ length: 31 }, (_, index) => ({
            timestamp: now - (30 - index) * 2000, ...FrameTimings(id, index)
        })))
    });
}

/** @brief 保存通道和模型元数据，避免把本地视频或模型文件写入持久配置。 */
export function SaveVideoWorkspace(workspace) {
    const config = Object.fromEntries(workspace.channels.map(({ id, name, source, algorithm, modelId, autostart }) =>
        [id, { name, source, algorithm, modelId, autostart }]));
    config.models = workspace.models.filter(model => model.status !== '内置基线');
    storage.setItem(CONFIG_KEY, JSON.stringify(config));
}

/** @brief 加入浏览器会话内的视频文件，供实时检测页选择。 */
export function AddVideoSource(workspace, file) {
    workspace.sources.push({ id: crypto.randomUUID(), name: file.name, size: file.size, createdAt: Date.now(), file: markRaw(file) });
}

/** @brief 添加模拟历史记录，同时限制记录数。 */
export function AddVideoRecord(workspace, channel, frame) {
    const record = { ...frame, id: workspace.nextRecord++, channelId: channel.id, createdAt: Date.now() };
    workspace.records.unshift(record);
    if (workspace.records.length > RECORD_LIMIT) {
        workspace.records.pop();
    }
}

/** @brief 记录性能读数，清理一小时前的样本。 */
export function SamplePerformance(workspace) {
    const now = Date.now();
    workspace.metrics.push(MetricSample(now));
    for (const [index, channel] of workspace.channels.entries()) {
        if (channel.state === 'running' && channel.frame?.timings) {
            workspace.timings[index].push({ timestamp: now, ...channel.frame.timings });
        }
    }
    for (const samples of [workspace.metrics, ...workspace.timings]) {
        while (samples.length && samples[0].timestamp < now - HOUR_MS) {
            samples.shift();
        }
    }
}

/** @brief 使用已应用条件查询记录，供分页、导出及统计共用。 */
export function FilterVideoRecords(workspace, filters) {
    const query = filters.query.trim().toLowerCase();
    const start = filters.start ? new Date(filters.start).getTime() : -Infinity;
    const end = filters.end ? new Date(filters.end).getTime() : Infinity;
    return workspace.records.filter(record => {
        const channelName = workspace.channels.find(channel => channel.id === record.channelId)?.name;
        const search = [record.id, record.modelId, channelName, ...record.detections.map(item => DetectionLabel(item.kind))].join(' ').toLowerCase();
        return (!filters.channel || filters.channel === record.channelId) && record.createdAt >= start && record.createdAt <= end && search.includes(query);
    });
}

/** @brief 统计采样值，返回空样本和真实的模拟样本覆盖区间。 */
export function SummarizeSamples(samples, readValue) {
    const valid = samples.filter(item => Number.isFinite(readValue(item)));
    const values = valid.map(readValue).sort((first, second) => first - second);
    const count = values.length;
    return {
        count, unavailable: samples.length - count, coverage: count < 2 ? 0 : (valid.at(-1).timestamp - valid[0].timestamp) / 1000,
        mean: count ? values.reduce((sum, value) => sum + value, 0) / count : null,
        p95: values[Math.ceil(count * 0.95) - 1] ?? null,
        min: values[0] ?? null, max: values.at(-1) ?? null
    };
}
