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
import { DetectionLabel, IsDemoRtspAddress, ModelDetections, ModelLabels } from './video-recognition';
import { CompareFrames, DrawSample, SAMPLE_HEIGHT, SAMPLE_WIDTH } from '@/utils/video-motion';

export const VIDEO_WORKSPACE = Symbol('video-workspace');
const CONFIG_KEY = 'video-workspace';
export const MAX_VIDEO_CHANNELS = 32;
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

/** @brief 初始化可编辑通道并迁移旧版摄像头参数。 */
export function MakeChannel(id, name, modelId, saved) {
    const legacy = id === 'person' || id === 'safety';
    const suffix = id === 'person' ? '' : ':safety';
    const camera = !saved && legacy ? ReadConfig(`video-camera${suffix}`) : {};
    const algorithm = !saved && legacy ? ReadConfig(`video-algorithm${suffix}`) : {};
    const previous = saved?.algorithm ?? algorithm;
    const modelSettings = saved?.modelSettings ?? [MakeModelSettings(saved?.modelId ?? modelId, previous)];
    return {
        id, name, autostart: true, ...saved, modelSettings,
        source: {
            type: camera.source === 'local' ? 'usb' : camera.source === 'rtsp' ? 'rtsp' : 'mp4',
            sourceId: 'sample', loop: camera.loop ?? true, rtspUrl: camera.rtspUrl ?? '',
            cameraIndex: 0, realUsb: camera.source === 'local', deviceId: camera.deviceId ?? '',
            resolution: camera.resolution ?? '1280x720', fps: camera.fps ?? 25, ...saved?.source
        },
        algorithm: { mode: 'model', confidence: 0.25, nmsIou: 0.45, showBox: true,
            sensitivity: 60, minArea: 0.8, interval: 250, ...algorithm, ...saved?.algorithm },
        state: 'stopped', frame: null, fps: 0, error: '', lastFailure: '', failedAt: null, startedAt: null, retries: 0
    };
}

/** @brief 为每个模型创建独立参数，并接受旧版单模型参数。 */
export function MakeModelSettings(modelId, previous, kind) {
    return { modelId, confidence: previous?.confidence ?? (kind === 'face' ? 0.8 : 0.25), nmsIou: previous?.nmsIou ?? 0.45 };
}

/** @brief 返回当前通道启用的模型及其配置。 */
export function ChannelModels(workspace, channel) {
    if (channel.algorithm.mode !== 'model') {
        return [];
    }
    return channel.modelSettings.flatMap(settings => {
        const model = workspace.models.find(item => item.id === settings.modelId);
        return model ? [{ id: model.id, name: model.name, kind: model.kind, settings }] : [];
    });
}

/** @brief 在同一模拟帧上执行所有已启用的算法。 */
export function AnalyzeModels(models, elapsed, sequence) {
    const modelResults = [];
    let timings = null;
    for (const model of models) {
        const profile = model.kind === 'yolo26n' ? 'safety' : model.kind;
        const detections = ModelDetections(elapsed, { ...model.settings, channelId: profile });
        modelResults.push({ id: model.id, name: model.name, detections });
        const sample = FrameTimings(profile, sequence);
        if (!timings) {
            timings = sample;
        } else {
            timings.inference += sample.inference;
            timings.postprocess += sample.postprocess;
            timings.pipeline += sample.inference + sample.postprocess;
        }
    }
    return { detections: modelResults.flatMap(result => result.detections), timings, modelResults };
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
            id: SAMPLE_COUNT - index, channelId, channelName: channelId === 'person' ? '人员检测' : '安全检测',
            modelId: channelId === 'person' ? 'person-baseline' : 'yolo26n-baseline',
            sequence: SAMPLE_COUNT - index, createdAt: now - (index + 1) * 300000, elapsed,
            width: 640, height: 360, mode: 'model',
            detections: ModelDetections(elapsed, { channelId, confidence: 0.25, nmsIou: 0.45 }), timings: FrameTimings(channelId, index)
        };
    });
}

/** @brief 初始化通道配置、模型资产、历史记录和性能样本。 */
export function CreateVideoWorkspace() {
    const now = Date.now();
    const saved = ReadConfig(CONFIG_KEY);
    const legacy = [
        MakeChannel('person', '人员检测', 'person-baseline', saved.person), MakeChannel('safety', '安全检测', 'yolo26n-baseline', saved.safety)
    ];
    const channels = Array.isArray(saved.channels) ? saved.channels.slice(0, MAX_VIDEO_CHANNELS).map(item =>
        MakeChannel(item.id, item.name, item.modelId, item)) : legacy;
    return reactive({
        channels, models: [MakeBaseline('person-baseline', '人形检测', 'person'),
            MakeBaseline('yolo26n-baseline', '安全帽识别', 'yolo26n'), MakeBaseline('face-baseline', '人脸比对', 'face'), ...(saved.models ?? [])],
        sources: [{ id: 'sample', name: '内置示例画面', size: null, createdAt: null }],
        records: SeedRecords(now), nextRecord: SAMPLE_COUNT + 1,
        sampledAt: now,
        timings: Object.fromEntries(legacy.map(channel => [channel.id, Array.from({ length: 31 }, (_, index) => ({
            timestamp: now - (30 - index) * 2000, ...FrameTimings(channel.id, index)
        }))]))
    });
}

/** @brief 区分依赖浏览器授权或文件的本地预览和模拟板端输入。 */
export function IsBrowserSource(source) {
    return (source.type === 'usb' && source.realUsb) || (source.type === 'mp4' && source.sourceId !== 'sample');
}

/** @brief 返回视频源的配置错误，空字符串表示可用于演示。 */
export function VideoSourceError(workspace, source) {
    if (source.type === 'rtsp' && !IsDemoRtspAddress(source.rtspUrl)) {
        return '请输入不含账号和密码的有效 RTSP 地址';
    }
    if (source.type === 'mp4' && !workspace.sources.some(item => item.id === source.sourceId)) {
        return '视频文件不可用，请重新添加本地 MP4 或选择内置示例';
    }
    if (source.type === 'usb' && !source.realUsb && (!Number.isInteger(source.cameraIndex) || source.cameraIndex < 0 || source.cameraIndex > 63)) {
        return '请输入 0–63 的 USB 摄像头编号';
    }
    return '';
}

/** @brief 返回视频源名称，供预览和运维使用。 */
export function VideoSourceName(workspace, source) {
    if (source.type === 'mp4') {
        return workspace.sources.find(item => item.id === source.sourceId)?.name ?? '本地 MP4 文件不可用';
    }
    if (source.type === 'rtsp') {
        return 'RTSP 摄像头（模拟）';
    }
    return source.realUsb ? '浏览器本机摄像头' : `AIBox USB ${source.cameraIndex}（模拟）`;
}

/** @brief 返回通道任务状态，浏览器输入只提供本地预览。 */
export function VideoChannelStatus(channel) {
    if (IsBrowserSource(channel.source)) {
        return '浏览器本地输入';
    }
    return { stopped: '已停止', running: '运行中', error: '输入故障' }[channel.state];
}

/** @brief 返回通道状态对应的视觉类型。 */
export function VideoStatusType(channel) {
    if (IsBrowserSource(channel.source)) {
        return 'info';
    }
    return { running: 'success', error: 'danger', stopped: 'info' }[channel.state];
}

/** @brief 保留最近故障原因，便于通道恢复后继续排查。 */
export function FailVideoChannel(channel, reason) {
    Object.assign(channel, { state: 'error', frame: null, fps: 0, error: reason, lastFailure: reason, failedAt: Date.now() });
}

/** @brief 启动或重连模拟 AIBox 通道。 */
export function StartVideoChannel(workspace, channel) {
    const error = VideoSourceError(workspace, channel.source);
    if (error) {
        FailVideoChannel(channel, error);
        return;
    }
    if (IsBrowserSource(channel.source)) {
        return;
    }
    if (channel.state === 'error') {
        channel.retries++;
    }
    Object.assign(channel, { state: 'running', frame: null, fps: 0, error: '', startedAt: performance.now() });
}

/** @brief 显式停止对应模拟通道，保留诊断历史。 */
export function StopVideoChannel(channel) {
    Object.assign(channel, { state: 'stopped', frame: null, fps: 0, error: '', startedAt: null });
}

function SampleMotion(runtime, elapsed, algorithm) {
    if (!runtime.canvas) {
        const canvas = document.createElement('canvas');
        canvas.width = SAMPLE_WIDTH;
        canvas.height = SAMPLE_HEIGHT;
        runtime.canvas = canvas.getContext('2d', { willReadFrequently: true });
    }
    if (elapsed - runtime.lastMotion >= algorithm.interval) {
        DrawSample(runtime.canvas, SAMPLE_WIDTH, SAMPLE_HEIGHT, elapsed);
        const pixels = runtime.canvas.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data;
        const region = runtime.pixels ? CompareFrames(runtime.pixels, pixels, algorithm.sensitivity) : null;
        Object.assign(runtime, { pixels, lastMotion: elapsed, region });
    }
    const region = runtime.region;
    const detections = region && region.percent >= algorithm.minArea ? [{
        kind: 'motion', score: null, x: region.x * 640, y: region.y * 360, width: region.width * 640, height: region.height * 360
    }] : [];
    return { detections, motion: region?.percent ?? 0 };
}

function RunFrame(workspace, channel, runtime, now) {
    if (channel.state !== 'running') {
        return;
    }
    if (runtime.startedAt !== channel.startedAt) {
        Object.assign(runtime, { startedAt: channel.startedAt, lastFrame: now, lastRecord: -Infinity, lastMotion: -Infinity, pixels: null, region: null });
    }
    const elapsed = Math.round(now - channel.startedAt);
    const { mode } = channel.algorithm;
    const sequence = ++runtime.sequence;
    const result = mode === 'motion' ? SampleMotion(runtime, elapsed, channel.algorithm) : AnalyzeModels(ChannelModels(workspace, channel), elapsed, sequence);
    const frame = { sequence, elapsed, mode, ...result, width: 640, height: 360, inputWidth: 640, inputHeight: 360 };
    channel.fps = Math.min(13, Math.round(1000 / Math.max(1, now - runtime.lastFrame)));
    runtime.lastFrame = now;
    channel.frame = frame;
    if (frame.timings && frame.detections.length && elapsed - runtime.lastRecord >= 12000) {
        runtime.lastRecord = elapsed;
        AddVideoRecord(workspace, channel, frame);
    }
}

/** @brief 在已登录的控制台内模拟板端任务，路由切换不会销毁通道。 */
export function RunVideoWorkspace(workspace) {
    const runtimes = new WeakMap();
    for (const channel of workspace.channels) {
        if (channel.autostart && !IsBrowserSource(channel.source)) {
            StartVideoChannel(workspace, channel);
        }
    }
    const frames = setInterval(() => {
        const now = performance.now();
        for (const channel of workspace.channels) {
            if (!runtimes.has(channel)) {
                runtimes.set(channel, { sequence: 0 });
            }
            RunFrame(workspace, channel, runtimes.get(channel), now);
        }
    }, 80);
    const performanceTimer = setInterval(() => SamplePerformance(workspace), 2000);
    return () => {
        clearInterval(frames);
        clearInterval(performanceTimer);
    };
}

/** @brief 保存通道和模型元数据，避免把本地视频或模型文件写入持久配置。 */
export function SaveVideoWorkspace(workspace) {
    const channels = workspace.channels.map(({ id, name, source, algorithm, modelSettings, autostart }) => ({
        id, name, source, algorithm, modelSettings, autostart
    }));
    const models = workspace.models.filter(model => model.status !== '内置基线');
    storage.setItem(CONFIG_KEY, JSON.stringify({ channels, models }));
}

/** @brief 加入浏览器会话内的视频文件，供实时检测页选择。 */
export function AddVideoSource(workspace, file) {
    workspace.sources.push({ id: crypto.randomUUID(), name: file.name, size: file.size, createdAt: Date.now(), file: markRaw(file) });
}

/** @brief 添加模拟历史记录，同时限制记录数。 */
export function AddVideoRecord(workspace, channel, frame) {
    const { modelResults, ...snapshot } = frame;
    const modelNames = modelResults?.map(result => result.name);
    const record = { ...snapshot, modelNames, id: workspace.nextRecord++, channelId: channel.id, channelName: channel.name, createdAt: Date.now() };
    workspace.records.unshift(record);
    if (workspace.records.length > RECORD_LIMIT) {
        workspace.records.pop();
    }
}

/** @brief 记录性能读数，清理一小时前的样本。 */
export function SamplePerformance(workspace) {
    const now = Date.now();
    workspace.sampledAt = now;
    for (const channel of workspace.channels) {
        if (channel.state === 'running' && channel.frame?.timings) {
            workspace.timings[channel.id] ??= [];
            workspace.timings[channel.id].push({ timestamp: now, ...channel.frame.timings });
        }
    }
    for (const samples of Object.values(workspace.timings)) {
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
        const channelName = record.channelName ?? workspace.channels.find(channel => channel.id === record.channelId)?.name;
        const labels = record.detections.map(item => DetectionLabel(item.kind));
        const search = [record.id, record.modelId, ...(record.modelNames ?? []), channelName, ...labels].join(' ').toLowerCase();
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
