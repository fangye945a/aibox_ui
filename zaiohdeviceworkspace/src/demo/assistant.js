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

import { ReadSystemMetric } from './system-monitor';
import { demoSocialQr } from './social-qr';

const SETTINGS_KEY = 'zaioh-pages-assistant-settings';
const SOCIAL_KEY = 'zaioh-pages-social-bindings';
const MODEL = 'deepseek-flash';
const BASE_URL = 'https://api.deepseek.com/v1';
const sleep = signal => new Promise((resolve, reject) => {
  signal?.throwIfAborted();
  const timer = setTimeout(resolve, 450);
  signal?.addEventListener('abort', () => {
    clearTimeout(timer);
    reject(signal.reason);
  }, { once: true });
});

function readSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

function status() {
  const saved = readSettings();
  const item = {
    model: saved.model || MODEL,
    baseURL: saved.baseURL || BASE_URL,
    hasAPIKey: true,
  };
  return {
    ready: true,
    demo: true,
    ...item,
    models: [item],
    detail: 'Pages 演示模式使用模拟设备数据回答常用问题。',
  };
}

function saveSettings(input) {
  const model = String(input?.model || '').trim();
  if (!model) throw new Error('请输入模型 ID');
  const baseURL = String(input?.baseURL || '').trim();
  if (!/^https?:\/\//.test(baseURL)) throw new Error('API Base URL 必须以 http:// 或 https:// 开头');
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ model, baseURL }));
  return status();
}

function socialState() {
  try {
    return JSON.parse(localStorage.getItem(SOCIAL_KEY)) || {};
  } catch {
    return {};
  }
}

function saveSocial(value) {
  localStorage.setItem(SOCIAL_KEY, JSON.stringify(value));
}

function qrData() {
  return demoSocialQr;
}

function social(platform, action = 'status', unbind = false) {
  const all = socialState();
  const current = all[platform] || { state: platform === 'feishu' ? 'connected' : 'unbound', bound: platform === 'feishu' };
  if (action === 'start') {
    all[platform] = { state: 'waiting', bound: false, startedAt: Date.now(), qr: qrData(platform) };
    saveSocial(all);
    return all[platform];
  }
  if (action === 'remove') {
    all[platform] = { state: 'unbound', bound: false, message: unbind ? '已解除绑定' : '已取消绑定' };
    saveSocial(all);
    return all[platform];
  }
  if (!current.bound && current.state === 'waiting' && Date.now() - current.startedAt > 4500) {
    all[platform] = { ...current, state: 'connected', bound: true, qr: '', message: '演示环境已完成模拟授权' };
    saveSocial(all);
    return all[platform];
  }
  return current;
}

function formatUptime(seconds) {
  return `${Math.floor(seconds / 86400)} 天 ${Math.floor(seconds / 3600) % 24} 小时 ${Math.floor(seconds / 60) % 60} 分钟`;
}

function answer({ question, attachments = [] }) {
  const now = Date.now();
  const cpu = ReadSystemMetric('cpu_usage', now);
  const memory = ReadSystemMetric('memory_used', now);
  const npu = ReadSystemMetric('npu_usage', now);
  const temperature = ReadSystemMetric('temperature', now);
  const sections = [];
  if (/cpu|内存|温度|npu|负载|资源/i.test(question)) {
    sections.push('### 当前设备资源\n\n| 指标 | 当前值 | 状态 |\n| --- | ---: | --- |\n| CPU 使用率 | ' + cpu + '% | 正常 |\n| 内存使用率 | ' + memory + '% | 正常 |\n| NPU 使用率 | ' + npu + '% | 正常 |\n| 芯片温度 | ' + temperature + ' °C | 正常 |');
  }
  if (/存储|磁盘|分区|空间/.test(question)) {
    sections.push('### 存储空间\n\n用户数据分区剩余 **71.2 GB**，系统分区剩余 **18.2 GB**。当前空间充足。');
  }
  if (/告警|报警|温度/.test(question)) {
    sections.push('### 告警提示\n\n当前有 **1 条活动告警**：CPU 使用率连续 30 秒超过 85%。智能问答会结合监控运维中的 60 秒趋势给出判断。');
  }
  if (/运行|在线|型号|版本|概况|状态/.test(question)) {
    sections.push('### 设备概况\n\n- 产品：**在鸿工控机 CT23**\n- 系统：OpenHarmony 6.1\n- 运行时间：' + formatUptime(123 * 3600 + 22 * 60) + '\n- 视频分析：四路通道运行正常');
  }
  if (attachments.length) {
    const names = attachments.map(file => '`' + file.name + '`').join('、');
    const excerpt = attachments.map(file => file.text?.slice(0, 120)).filter(Boolean).join(' ');
    sections.push('### 附件分析\n\n已读取附件 ' + names + '。演示环境已接收正文并完成内容索引。\n\n> ' + (excerpt || '附件内容已读取。'));
  }
  if (!sections.length) {
    sections.push('我是 **ZaiAgent**，可以查询设备资源、存储空间、系统告警、运行状态，也可以分析文本、Word 和 PDF 附件。\n\n你可以试试：\n\n1. 查看当前 CPU 和温度\n2. 系统告警有哪些\n3. 分析我上传的文档');
  }
  return {
    text: sections.join('\n\n'), sources: ['当前设备概况', '监控运维演示数据'],
    sampledAt: new Date(now).toISOString(),
  };
}

/** @brief 与真实 PicoClaw 助手接口保持一致，替换网络后端为浏览器内演示。 */
export function CreateDemoAssistantApi() {
  return {
    async Status() { await sleep(); return status(); },
    async Save(input) { await sleep(); return saveSettings(input); },
    async Test(model, signal) {
      await sleep(signal);
      if (!model) throw new Error('请选择模型');
      return { model };
    },
    async Ask(input, signal) {
      await sleep(signal);
      return answer(input);
    },
    async Extract(file, signal) {
      signal?.throwIfAborted();
      const name = String(file?.name || 'attachment');
      if (/\.pdf$/i.test(name)) {
        return { text: `演示附件解析结果（${name}）：\n设备操作指导文档，包含登录、视频分析、智能问答和运维监控等章节。`, truncated: false };
      }
      if (/\.(docx?|pdf)$/i.test(name)) {
        return { text: `演示附件解析结果（${name}）：\n已完成 Word/PDF 正文提取，可用于设备问答和知识库测试。`, truncated: false };
      }
      throw new Error('仅支持 Word、PDF 和 UTF-8 文本文件');
    },
    async SocialStatus(platform) { await sleep(); return social(platform); },
    async SocialStart(platform) { await sleep(); return social(platform, 'start'); },
    async SocialRemove(platform, unbind) { await sleep(); return social(platform, 'remove', unbind); },
  };
}
