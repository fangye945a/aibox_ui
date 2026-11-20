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
import { inject } from 'vue';
import request from '@/config/axios';
import { ReadSystemMetric, SYSTEM_MONITOR } from '@/demo/system-monitor';

const SAMPLE_MS = 5000;
const g_topics = [
    { pattern: /cpu|内存|温度|npu|负载|资源/i, name: 'metrics' },
    { pattern: /存储|磁盘|分区|空间/, name: 'storage' },
    { pattern: /告警|报警|越限/, name: 'alerts' },
    { pattern: /运行|在线|型号|版本|概况|状态/, name: 'overview' },
];

function MatchTopics(question) {
    return g_topics.filter(({ pattern }) => pattern.test(question)).map(({ name }) => name);
}

function WaitForDemo(signal) {
    return new Promise((resolve, reject) => {
        signal.throwIfAborted();
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', Abort);
            resolve();
        }, 500);
        function Abort() {
            clearTimeout(timer);
            reject(signal.reason);
        }
        signal.addEventListener('abort', Abort, { once: true });
    });
}

function FormatUptime(seconds) {
    return `${Math.floor(seconds / 86400)} 天 ${Math.floor(seconds / 3600) % 24} 小时 ${Math.floor(seconds / 60) % 60} 分钟`;
}

/** @brief 使用控制台的模拟设备数据回答常用问题。 */
export function CreateAssistantApi() {
    const monitor = inject(SYSTEM_MONITOR);
    return {
        async Status() {
            return { ready: true, demo: true, model: '设备数据演示', detail: '使用当前演示设备的数据，支持资源、存储、告警和运行时间查询。' };
        },
        async Ask({ question, history }, signal) {
            await WaitForDemo(signal);
            const { data } = await request.get('/api/system/info', { signal, silentError: true });
            const timestamp = monitor.timestamp ?? Math.floor(Date.now() / SAMPLE_MS) * SAMPLE_MS;
            let topics = MatchTopics(question);
            if (!topics.length && /^(那|再|呢)|刚才|还有|多少/.test(question)) {
                topics = MatchTopics(history.at(-2)?.content || '');
            }
            const answers = [];
            const sources = [];
            if (topics.includes('metrics')) {
                const cpu = ReadSystemMetric('cpu_usage', timestamp);
                const memory = ReadSystemMetric('memory_used', timestamp);
                const npu = ReadSystemMetric('npu_usage', timestamp);
                const temperature = ReadSystemMetric('temperature', timestamp);
                answers.push(`CPU 使用率 ${cpu}%，内存使用率 ${memory}%，NPU 使用率 ${npu}%，芯片温度 ${temperature} °C。`);
                sources.push('模拟整机指标');
            }
            if (topics.includes('storage')) {
                const storage = data.storage_info;
                const total = Number((storage.storage_used + storage.storage_can_used).toFixed(1));
                answers.push(`用户数据分区总量 ${total} GB，已用 ${storage.storage_used} GB，可用 ${storage.storage_can_used} GB。`);
                sources.push('模拟设备概况');
            }
            if (topics.includes('alerts')) {
                const records = monitor.records.slice(0, 5);
                const items = records.map(({ type, reason, timestamp }) => `${new Date(timestamp).toLocaleString('zh-CN')}  ${type}：${reason}`);
                answers.push(items.length ? `最近 ${items.length} 条系统告警：\n${items.join('\n')}` : '当前没有系统告警记录。');
                sources.push('模拟系统告警');
            }
            if (topics.includes('overview')) {
                const device = data.device_info;
                answers.push(`${device.product_model} · ${device.system_version}\n设备已运行 ${FormatUptime(data.boot_time)}。`);
                sources.push('模拟设备概况');
            }
            return {
                text: answers.join('\n\n') || '演示支持查询 CPU、内存、NPU、温度、存储、系统告警和运行时间。可以试试右侧的常用问题。',
                sources: [...new Set(sources)],
                sampledAt: sources.length ? new Date(timestamp).toISOString() : '',
            };
        },
    };
}
