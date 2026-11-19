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

import { reactive } from 'vue';
import { storage } from './storage';

export const SYSTEM_MONITOR = Symbol('system-monitor');
const ALERT_KEY = 'system-alerts-v1';
const SAMPLE_MS = 5000;
const ALERT_LIMIT = 250;
const g_profiles = {
    cpu_usage: [37, 8, 49, 0], memory_used: [60, 5, 32, 0.8], npu_usage: [52, 9, 42, 1.1], temperature: [57, 5, 28, 1.4],
    uplink_network: [820, 210, 590, 1.3], downstream_network: [1450, 340, 1320, 1.7],
    disk_read_rate: [210, 67, 380, 2.2], disk_write_rate: [95, 28, 260, 2.9]
};
const g_rules = [
    { key: 'cpu_usage', name: 'CPU 使用率过高', threshold: 85, unit: '%', recovery: 80, demo: 96 },
    { key: 'memory_used', name: '内存使用率过高', threshold: 90, unit: '%', recovery: 85, demo: 95 },
    { key: 'npu_usage', name: 'NPU 使用率过高', threshold: 90, unit: '%', recovery: 85, demo: 97 },
    { key: 'temperature', name: '芯片温度过高', threshold: 80, unit: ' °C', recovery: 75, demo: 86 }
];
const g_demoSamples = new Map();

/** @brief 生成图表和系统告警共用的模拟整机读数。 */
export function ReadSystemMetric(key, timestamp) {
    const profile = g_profiles[key];
    if (!Array.isArray(profile)) {
        return null;
    }
    const override = g_demoSamples.get(timestamp)?.[key];
    if (override !== undefined) {
        return override;
    }
    const [base, variation, peak, phase] = profile;
    const wave = Math.sin(timestamp / 52000 + phase) + 0.4 * Math.sin(timestamp / 12000 + phase);
    const burst = Math.max(0, Math.cos(timestamp / 25000 + phase)) ** 8;
    const value = base + variation * wave + peak * burst;
    const percent = ['cpu_usage', 'memory_used', 'npu_usage'].includes(key);
    return Number((percent ? Math.min(100, value) : value).toFixed(2));
}

function ReadAlerts() {
    try {
        const saved = JSON.parse(storage.getItem(ALERT_KEY));
        return { records: Array.isArray(saved?.records) ? saved.records : [], active: saved?.active ?? {} };
    } catch {
        return { records: [], active: {} };
    }
}

function StoreAlerts(monitor, records, active) {
    try {
        storage.setItem(ALERT_KEY, JSON.stringify({ records, active }));
        monitor.storageError = '';
    } catch {
        monitor.storageError = '浏览器存储不可用，告警无法跨重启保留';
    }
    Object.assign(monitor, { records, active });
}

/** @brief 恢复告警记录及各项指标当前的告警周期。 */
export function CreateSystemMonitor() {
    return reactive({ ...ReadAlerts(), timestamp: null, storageError: '' });
}

function SampleAlerts(monitor, timestamp, demo = false) {
    const active = { ...monitor.active };
    const records = [...monitor.records];
    let changed = false;
    for (const rule of g_rules) {
        const value = ReadSystemMetric(rule.key, timestamp);
        if (active[rule.key] && value < rule.recovery) {
            delete active[rule.key];
            changed = true;
        } else if (!active[rule.key] && value > rule.threshold) {
            active[rule.key] = true;
            const reason = `采样值 ${value}${rule.unit}，超过告警阈值 ${rule.threshold}${rule.unit}`;
            records.unshift({ id: `${rule.key}-${timestamp}`, type: rule.name, reason, timestamp, demo });
            changed = true;
        }
    }
    monitor.timestamp = timestamp;
    if (changed) {
        StoreAlerts(monitor, records.slice(0, ALERT_LIMIT), active);
    }
}

/** @brief 每五秒采样并记录越限，同一告警周期只新增一次。 */
export function RunSystemMonitor(monitor) {
    const sample = () => {
        const now = Math.floor(Date.now() / SAMPLE_MS) * SAMPLE_MS;
        if (now !== monitor.timestamp) {
            SampleAlerts(monitor, now);
        }
    };
    sample();
    const timer = setInterval(sample, SAMPLE_MS);
    return () => clearInterval(timer);
}

/** @brief 产生一次演示越限，曲线查询可读取同一采样值。 */
export function SimulateSystemOverload(monitor) {
    const now = Math.floor(Date.now() / SAMPLE_MS) * SAMPLE_MS;
    g_demoSamples.set(now, Object.fromEntries(g_rules.map(rule => [rule.key, rule.demo])));
    for (const timestamp of g_demoSamples.keys()) {
        if (timestamp < now - 86400000) {
            g_demoSamples.delete(timestamp);
        }
    }
    SampleAlerts(monitor, now, true);
}

/** @brief 清除告警记录，仍在越限的指标恢复后才会生成下一条。 */
export function ClearSystemAlerts(monitor) {
    StoreAlerts(monitor, [], monitor.active);
}
