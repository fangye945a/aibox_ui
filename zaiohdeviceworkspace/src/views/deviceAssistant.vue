<!--
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
-->
<template>
    <div class="assistant-page">
        <div class="assistant-intro">
            <p>查询设备状态、资源使用情况和系统告警。</p>
            <el-tag :type="status.demo ? 'info' : status.ready ? 'success' : 'warning'" effect="light">
                {{ status.demo ? '模拟演示' : status.label }}
            </el-tag>
        </div>

        <div class="assistant-grid">
            <section class="assistant-card conversation" aria-label="设备问答">
                <header class="card-header">
                    <strong>设备问答</strong>
                    <el-button size="small" :disabled="!messages.length && !draft" @click="ClearChat">新对话</el-button>
                </header>
                <div ref="messageArea" class="messages" role="log" aria-label="问答记录">
                    <div v-if="!messages.length" class="empty-chat">
                        <el-icon :size="27"><ChatDotRound /></el-icon>
                        <strong>想了解设备的哪些情况？</strong>
                        <span>选择一个常用问题，或输入你想查询的内容。</span>
                    </div>
                    <article v-for="(message, index) in messages" :key="index" class="message" :class="message.role">
                        <small>{{ message.role === 'user' ? '你' : '设备助手' }}</small>
                        <div class="message-text">{{ message.content }}</div>
                        <small v-if="message.sampledAt" class="message-source">{{ SourceLabel(message) }}</small>
                    </article>
                    <p v-if="pending" class="response-state" role="status">正在读取设备数据并生成回答…</p>
                </div>
                <form class="composer" @submit.prevent="SendQuestion()">
                    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
                    <el-input v-model="draft" type="textarea" :rows="3" maxlength="500" show-word-limit resize="none"
                        aria-label="输入问题" placeholder="输入你想查询的设备问题" />
                    <div class="composer-actions">
                        <el-button v-if="pending" native-type="button" @click="StopQuestion">停止回答</el-button>
                        <el-button type="primary" native-type="submit" :disabled="pending || !status.ready || !draft.trim()">发送</el-button>
                    </div>
                </form>
            </section>

            <aside class="assistant-side">
                <section class="assistant-card side-card">
                    <h2>常用问题</h2>
                    <button v-for="question in questions" :key="question" type="button" class="question"
                        :disabled="!status.ready || pending" @click="SendQuestion(question)">
                        {{ question }} <el-icon><ArrowRight /></el-icon>
                    </button>
                </section>
                <section class="assistant-card side-card">
                    <div class="model-heading">
                        <h2>问答服务</h2>
                        <el-button link type="primary" :loading="checking" @click="RefreshStatus">刷新</el-button>
                    </div>
                    <p class="model-name">{{ status.model || status.label }}</p>
                    <p class="model-description">{{ status.detail }}</p>
                </section>
            </aside>
        </div>
    </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { ArrowRight, ChatDotRound } from '@element-plus/icons-vue';
import { CreateAssistantApi } from '@/api/assistant';

const MAX_TURNS = 3;
const MAX_HISTORY_ANSWER = 600;
const api = CreateAssistantApi();
const questions = [
    '当前 CPU、内存和温度是多少？',
    '用户数据分区还剩多少空间？',
    '最近有哪些系统告警？',
    '设备已运行多长时间？',
];
const messages = ref([]);
const draft = ref('');
const error = ref('');
const pending = ref(false);
const checking = ref(false);
const messageArea = ref(null);
const status = ref({ ready: false, label: '检测中', detail: '正在检测问答服务。' });
let chatRequest = null;
let statusRequest = null;

async function ScrollToLatest() {
    await nextTick();
    if (messageArea.value) {
        messageArea.value.scrollTop = messageArea.value.scrollHeight;
    }
}

async function RefreshStatus() {
    if (statusRequest) {
        return;
    }
    const controller = new AbortController();
    statusRequest = controller;
    checking.value = true;
    try {
        status.value = await api.Status(controller.signal);
    } catch {
        if (!controller.signal.aborted) {
            status.value = { ready: false, label: '服务不可用', detail: '无法读取问答服务状态，请刷新重试。' };
        }
    } finally {
        checking.value = false;
        statusRequest = null;
    }
}

function SourceLabel(message) {
    const stamp = new Date(message.sampledAt).toLocaleString('zh-CN', { hour12: false });
    const source = message.sources?.join('、') || '问答数据';
    return `${source} · ${stamp}`;
}

async function SendQuestion(question = draft.value) {
    const content = question.trim();
    if (!content || pending.value || !status.value.ready) {
        return;
    }
    const history = messages.value.slice(-MAX_TURNS * 2).map(({ role, content }) => ({
        role,
        content: role === 'assistant' ? Array.from(content).slice(0, MAX_HISTORY_ANSWER).join('') : content,
    }));
    const controller = new AbortController();
    chatRequest = controller;
    error.value = '';
    draft.value = '';
    messages.value.push({ role: 'user', content });
    pending.value = true;
    ScrollToLatest();
    try {
        const answer = await api.Ask({ question: content, history }, controller.signal);
        if (chatRequest === controller) {
            messages.value.push({ ...answer, role: 'assistant', content: answer.text });
        }
    } catch (reason) {
        if (chatRequest === controller) {
            messages.value.pop();
            draft.value ||= content;
            error.value = reason.message || '回答失败，请重试。';
        }
    } finally {
        if (chatRequest === controller) {
            chatRequest = null;
            pending.value = false;
            ScrollToLatest();
        }
    }
}

function StopQuestion() {
    if (chatRequest) {
        chatRequest.abort();
        chatRequest = null;
        const stopped = messages.value.pop();
        draft.value ||= stopped.content;
        pending.value = false;
    }
}

function ClearChat() {
    StopQuestion();
    messages.value = [];
    draft.value = '';
    error.value = '';
}

onMounted(RefreshStatus);
onBeforeUnmount(() => {
    StopQuestion();
    statusRequest?.abort();
});
</script>

<style scoped>
.assistant-page { padding: 24px; color: #2b3f5c; font-size: 14px; max-width: 1440px; margin: auto; }
.assistant-intro, .card-header, .model-heading, .question, .composer-actions {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
.assistant-intro { margin-bottom: 14px; }
.assistant-intro p, .model-description { margin: 0; color: #66758a; line-height: 1.6; }
.assistant-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(215px, 275px); gap: 16px; align-items: start; }
.assistant-card { min-width: 0; background: #fff; border: 1px solid #e6edf5; border-radius: 10px; overflow: hidden; }
.card-header { padding: 13px 16px; border-bottom: 1px solid #e6edf5; }
.messages { height: clamp(210px, calc(100dvh - 390px), 570px); overflow-y: auto; padding: 16px; }
.empty-chat {
    min-height: 100%; display: grid; place-content: center; justify-items: center; gap: 10px; text-align: center; color: #66758a;
}
.empty-chat .el-icon { padding: 11px; color: #007cf7; background: #edf6ff; border-radius: 12px; box-sizing: content-box; }
.empty-chat strong { color: #2b3f5c; font-size: 16px; }
.message { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; margin-bottom: 18px; }
.message.user { align-items: flex-end; }
.message small, .response-state { color: #66758a; font-size: 12px; }
.message-text {
    max-width: min(90%, 680px); white-space: pre-wrap; overflow-wrap: anywhere; padding: 10px 13px;
    border-radius: 8px; background: #f2f5f9; line-height: 1.65;
}
.user .message-text { background: #e8f3ff; color: #174c80; }
.composer { display: grid; gap: 10px; padding: 14px 16px; border-top: 1px solid #e6edf5; }
.composer-actions { justify-content: flex-end; }
.assistant-side { display: grid; gap: 16px; }
.side-card { padding: 16px; }
.side-card h2 { margin: 0 0 12px; font-size: 15px; color: #1d2129; }
.model-heading h2 { margin: 0; }
.model-name { color: #2b3f5c; overflow-wrap: anywhere; margin: 12px 0 6px; font-weight: 600; }
.question { width: 100%; margin-top: 8px; padding: 8px 10px; min-height: 38px; color: #2b3f5c; font: inherit; text-align: left; background: #f7f9fc;
    border: 1px solid #e6edf5; border-radius: 6px; cursor: pointer; }
.question .el-icon { flex-shrink: 0; }
.question:hover:not(:disabled) { border-color: #8fc1f7; color: #006bd6; }
.question:disabled { opacity: .62; cursor: default; }
@media (max-width: 850px) {
    .assistant-page { padding: 14px; }
    .assistant-grid { grid-template-columns: minmax(0, 1fr); }
    .messages { height: clamp(190px, 36dvh, 310px); }
}
</style>
