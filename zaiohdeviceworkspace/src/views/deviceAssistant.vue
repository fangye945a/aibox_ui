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
    <div class="assistant-page" :class="{ 'has-chat': messages.length > 0 }">
        <header class="assistant-toolbar">
            <el-button v-if="hasConversation" :icon="EditPen" text @click="confirmNewChat = true">新对话</el-button>
            <el-button :icon="Setting" text @click="OpenSettings">智能体设置</el-button>
        </header>

        <section class="conversation" aria-label="设备问答">
            <h2 v-if="!messages.length" class="assistant-greeting">你好，我是 <span>ZaiAgent</span></h2>
            <div v-else ref="messageArea" class="messages" role="log" aria-label="问答记录">
                <article v-for="(message, index) in messages" :key="index" class="message" :class="message.role">
                    <div v-if="message.role === 'assistant'" class="message-author">
                        <img :src="avatar" alt="" width="28" height="28" /> ZaiAgent
                    </div>
                    <div v-if="message.files?.length" class="chat-files">
                        <span v-for="(file, fileIndex) in message.files" :key="fileIndex" class="file-chip">
                            <el-icon><Document /></el-icon>
                            <button v-if="IsMarkdown(file)" type="button" class="markdown-file"
                                :aria-label="'预览 ' + file.name" @click="PreviewMarkdown(file)">{{ file.name }}</button>
                            <span v-else>{{ file.name }}</span>
                        </span>
                    </div>
                    <MarkdownContent v-if="message.role === 'assistant'" :source="message.content" class="message-text" />
                    <div v-else-if="message.content" class="message-text">{{ message.content }}</div>
                </article>
                <p v-if="pending" class="response-state" role="status">正在生成回答…</p>
            </div>

            <form class="composer" :class="{ 'is-dragging': dragDepth > 0 }" @submit.prevent="SendQuestion"
                @dragenter="EnterDropZone" @dragover="AllowDrop" @dragleave="LeaveDropZone" @drop="DropFiles">
                <img class="composer-avatar" :src="avatar" alt="ZaiAgent" width="91" height="72" />
                <input ref="filePicker" class="file-picker" type="file" :accept="FILE_ACCEPT" multiple
                    aria-label="添加附件" @change="PickFiles" />
                <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
                <div v-if="attachments.length" class="chat-files">
                    <span v-for="(file, index) in attachments" :key="index" class="file-chip">
                        <el-icon><Document /></el-icon>
                        <button v-if="IsMarkdown(file)" type="button" class="markdown-file" :title="file.name"
                            :aria-label="'预览 ' + file.name" @click="PreviewMarkdown(file)">{{ file.name }}</button>
                        <span v-else :title="file.name">{{ file.name }}</span>
                        <small v-if="file.truncated" title="仅发送已提取的前 8 KiB 正文">正文已截取</small>
                        <button type="button" :aria-label="'移除 ' + file.name" @click="attachments.splice(index, 1)">
                            <el-icon><Close /></el-icon>
                        </button>
                    </span>
                </div>
                <p v-if="readingFiles" class="response-state" role="status">正在读取附件…</p>
                <el-input ref="questionInput" v-model="draft" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }"
                    maxlength="500" resize="none" aria-label="输入问题" placeholder="想了解设备的哪些情况？"
                    @keydown="HandleQuestionKeydown" />
                <div class="composer-actions">
                    <el-dropdown trigger="click" placement="top-start" @command="OpenExtension">
                        <el-button class="add-button" circle :icon="Plus" native-type="button" aria-label="添加与扩展" />
                        <template #dropdown>
                            <el-dropdown-menu>
                                <el-dropdown-item command="files" :icon="Document">添加文件</el-dropdown-item>
                                <el-dropdown-item divided command="feishu">接入飞书</el-dropdown-item>
                                <el-dropdown-item command="qq">接入 QQ</el-dropdown-item>
                                <el-dropdown-item command="weixin">接入微信</el-dropdown-item>
                                <el-dropdown-item disabled>添加知识库（预留）</el-dropdown-item>
                            </el-dropdown-menu>
                        </template>
                    </el-dropdown>
                    <span class="composer-spacer"></span>
                    <el-button v-if="pending" native-type="button" text @click="StopQuestion">停止回答</el-button>
                    <el-button v-else class="send-button" circle type="primary" native-type="submit"
                        :icon="Top" :disabled="!canSend" aria-label="发送" />
                    <el-dropdown trigger="click" placement="top-end" @command="SelectModel">
                        <el-button class="model-trigger" native-type="button" text aria-label="选择模型">
                            <span :title="selectedModel">{{ selectedModel || '选择模型' }}</span><el-icon><ArrowDown /></el-icon>
                        </el-button>
                        <template #dropdown>
                            <el-dropdown-menu>
                                <el-dropdown-item v-for="option in availableModels" :key="option.model" :command="option.model">
                                    {{ option.model }}<el-icon v-if="option.model === selectedModel"><Check /></el-icon>
                                </el-dropdown-item>
                            <el-dropdown-item :command="false" :divided="availableModels.length > 0">配置模型</el-dropdown-item>
                            </el-dropdown-menu>
                        </template>
                    </el-dropdown>
                </div>
                <div v-if="dragDepth > 0" class="drop-overlay">松开即可添加文件</div>
            </form>

            <div v-if="!messages.length" class="questions" aria-label="常用问题">
                <button v-for="question in questions" :key="question" type="button" class="question" @click="ChooseQuestion(question)">
                    {{ question }} <el-icon><TopRight /></el-icon>
                </button>
            </div>
        </section>
        <SocialBinding v-model="socialOpen" :platform="socialPlatform" />
        <el-dialog v-model="confirmNewChat" title="新对话" width="min(400px, calc(100vw - 28px))">
            <p class="confirm-copy">新建对话将清除当前聊天记录、草稿和附件，清除后无法恢复。</p>
            <template #footer>
                <el-button @click="confirmNewChat = false">取消</el-button>
                <el-button type="danger" @click="ClearChat">清除并新建</el-button>
            </template>
        </el-dialog>
        <el-dialog v-model="previewOpen" :title="markdownPreview?.name || 'Markdown 预览'"
            width="min(760px, calc(100vw - 28px))" @closed="markdownPreview = null">
            <MarkdownContent v-if="markdownPreview" :source="markdownPreview.text" class="markdown-preview" />
        </el-dialog>
        <el-dialog v-model="settingsOpen" title="智能体设置" width="min(550px, calc(100vw - 28px))">
            <el-tabs v-model="modelTab">
                <el-tab-pane label="云端模型" name="cloud">
                    <form class="settings" @submit.prevent="SaveSettings">
                        <label>已配置模型<select :value="editingModel" @change="EditModel($event.target.value)">
                            <option value="">添加模型</option>
                            <option v-for="option in availableModels" :key="option.model" :value="option.model">{{ option.model }}</option>
                        </select></label>
                        <label>API Base URL<input v-model.trim="settings.baseURL" type="url" required
                            placeholder="https://api.example.com/v1" maxlength="500" /></label>
                        <label>模型 ID<input v-model.trim="settings.model" required
                            placeholder="例如 deepseek-flash" maxlength="128" /></label>
                        <label>API Key<input v-model="settings.apiKey" type="password" autocomplete="new-password"
                            :placeholder="canReuseKey ? '留空使用当前地址已配置的密钥' : '输入 API Key'" maxlength="2048" /></label>
                        <p class="model-description">支持 OpenAI 兼容的 Chat Completions 接口。</p>
                        <p v-if="settingsMessage" :class="{ 'settings-error': !!settingsError }" role="status">{{ settingsMessage }}</p>
                        <div class="composer-actions">
                            <el-button :disabled="!status.ready || saving || settingsDirty" :loading="testing" @click="TestSettings">测试连接</el-button>
                            <el-button type="primary" native-type="submit" :loading="saving" :disabled="testing">保存</el-button>
                        </div>
                    </form>
                </el-tab-pane>
                <el-tab-pane label="本地模型" name="local">
                    <p class="model-description">本地模型预留，当前问答使用云端模型。</p>
                </el-tab-pane>
            </el-tabs>
        </el-dialog>
    </div>
</template>

<script setup>
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, ref } from 'vue';
import { ArrowDown, Check, Close, Document, EditPen, Plus, Setting, Top, TopRight } from '@element-plus/icons-vue';
import { CreateAssistantApi } from '@/api/assistant';
import avatar from '@/assets/img/zaiagent.webp';
import MarkdownContent from '@/components/MarkdownContent.vue';
import SocialBinding from '@/components/SocialBinding.vue';

const socialOpen = ref(false);
const socialPlatform = ref('feishu');

defineOptions({ name: 'DeviceAssistant' });

const MAX_TURNS = 3;
const MAX_HISTORY_ANSWER = 600;
const FILE_ACCEPT = '.txt,.md,.csv,.tsv,.log,.json,.xml,.yaml,.yml,.doc,.docx,.pdf';
const fileExtensions = FILE_ACCEPT.split(',');
const documentExtensions = ['.doc', '.docx', '.pdf'];
const MAX_FILE_BYTES = 8 * 1024;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 16 * 1024;
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
const messageArea = ref(null);
const questionInput = ref(null);
const filePicker = ref(null);
const attachments = ref([]);
const confirmNewChat = ref(false);
const markdownPreview = ref(null);
const previewOpen = ref(false);
const readingFiles = ref(false);
const dragDepth = ref(0);
const status = ref({ ready: false });
const selectedModel = ref('');
const editingModel = ref('');
const settingsOpen = ref(false);
const modelTab = ref('cloud');
const settings = ref({ baseURL: '', model: '', apiKey: '' });
const saving = ref(false);
const testing = ref(false);
const settingsMessage = ref('');
const settingsError = ref(false);
const availableModels = computed(() => status.value.models || (status.value.model ? [status.value] : []));
const canReuseKey = computed(() => availableModels.value.some(item => item.hasAPIKey &&
    item.baseURL === settings.value.baseURL.replace(/\/+$/, '')));
const settingsDirty = computed(() => !availableModels.value.some(item =>
    item.model === settings.value.model && item.baseURL === settings.value.baseURL) || !!settings.value.apiKey);
const canSend = computed(() => !pending.value && !readingFiles.value && status.value.ready &&
    !!selectedModel.value && (!!draft.value.trim() || attachments.value.length > 0));
const hasConversation = computed(() => messages.value.length > 0 || !!draft.value ||
    attachments.value.length > 0 || readingFiles.value);
let testRequest;
let chatRequest = null;
let submittedFiles = [];
let attachmentContext = null;
let statusRequest = null;
let attachmentRequest = null;

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
    try {
        status.value = await api.Status(controller.signal);
        if (!availableModels.value.some(item => item.model === selectedModel.value)) {
            selectedModel.value = status.value.model || '';
        }
    } catch {
        if (!controller.signal.aborted) {
            status.value = { ready: false };
            error.value = '无法读取问答服务状态，请刷新重试。';
        }
    } finally {
        statusRequest = null;
    }
}

function OpenSettings() {
    EditModel(selectedModel.value);
    modelTab.value = 'cloud';
    settingsOpen.value = true;
}

function EditModel(id) {
    const item = availableModels.value.find(option => option.model === id);
    editingModel.value = item?.model || '';
    settings.value = { baseURL: item?.baseURL || status.value.baseURL || '', model: item?.model || '', apiKey: '' };
    settingsMessage.value = '';
}

function SelectModel(id) {
    if (id) selectedModel.value = id;
    else OpenSettings();
}

async function SaveSettings() {
    saving.value = true;
    settingsMessage.value = '';
    try {
        status.value = await api.Save(settings.value);
        attachmentContext = null;
        selectedModel.value = status.value.model;
        editingModel.value = status.value.model;
        settings.value = { baseURL: status.value.baseURL, model: status.value.model, apiKey: '' };
        settingsError.value = false;
        settingsMessage.value = '云端模型已保存。';
    } catch (reason) {
        settingsError.value = true;
        settingsMessage.value = reason.message;
    } finally {
        saving.value = false;
    }
}

async function TestSettings() {
    const controller = new AbortController();
    testRequest = controller;
    testing.value = true;
    settingsMessage.value = '';
    try {
        const result = await api.Test(settings.value.model, controller.signal);
        settingsError.value = false;
        settingsMessage.value = result.model + ' 已返回回答。';
    } catch (reason) {
        if (!controller.signal.aborted) {
            settingsError.value = true;
            settingsMessage.value = reason.message;
        }
    } finally {
        testing.value = false;
        testRequest = null;
    }
}

function ChooseQuestion(question) {
    draft.value = question;
    questionInput.value?.focus();
}

function OpenExtension(command) {
    if (command === 'files') {
        filePicker.value?.click();
    } else {
        socialPlatform.value = command;
        socialOpen.value = true;
    }
}

function IsMarkdown(file) {
    return /\.md$/i.test(file.name);
}

function PreviewMarkdown(file) {
    markdownPreview.value = file;
    previewOpen.value = true;
}

async function AddFiles(files) {
    if (readingFiles.value || pending.value) return;
    const controller = new AbortController();
    attachmentRequest = controller;
    readingFiles.value = true;
    error.value = '';
    try {
        for (const file of files) {
            const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
            const document = documentExtensions.includes(ext);
            const total = attachments.value.reduce((sum, item) => sum + item.size, 0);
            if (!fileExtensions.includes(ext) || file.size === 0 ||
                file.size > (document ? MAX_DOCUMENT_BYTES : MAX_FILE_BYTES) ||
                new TextEncoder().encode(file.name).length > 255) {
                error.value = '请选择不超过 10 MiB 的 Word 或 PDF，或不超过 8 KiB 的 UTF-8 文本文件。';
                continue;
            }
            if (attachments.value.length >= 3 || total >= MAX_TOTAL_BYTES) {
                error.value = '每次最多添加 3 个文件，提取的正文合计不超过 16 KiB。';
                break;
            }
            try {
                const { text, truncated } = document ? await api.Extract(file, controller.signal) :
                    { text: new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()), truncated: false };
                if (controller.signal.aborted) return;
                if (!text || /\p{Cc}/u.test(text.replace(/[\r\n\t]/g, ''))) {
                    throw new Error('无法读取附件，请使用 UTF-8 文本文件。');
                }
                const size = new TextEncoder().encode(text).length;
                if (total + size > MAX_TOTAL_BYTES) {
                    error.value = '附件正文合计不能超过 16 KiB。';
                    continue;
                }
                attachments.value.push({ name: file.name, text, size, truncated });
            } catch (reason) {
                if (controller.signal.aborted) return;
                error.value = document ? reason.message : '无法读取附件，请使用 UTF-8 文本文件。';
            }
        }
    } finally {
        readingFiles.value = false;
        attachmentRequest = null;
        if (!controller.signal.aborted) questionInput.value?.focus();
    }
}

function PickFiles(event) {
    const files = Array.from(event.target.files);
    event.target.value = '';
    void AddFiles(files);
}

function EnterDropZone(event) {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepth.value++;
}

function AllowDrop(event) {
    if (event.dataTransfer.types.includes('Files')) event.preventDefault();
}

function LeaveDropZone() {
    dragDepth.value = Math.max(0, dragDepth.value - 1);
}

function DropFiles(event) {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepth.value = 0;
    void AddFiles(Array.from(event.dataTransfer.files));
}

function HandleQuestionKeydown(event) {
    if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229 ||
        event.altKey || event.metaKey || event.shiftKey) {
        return;
    }
    event.preventDefault();
    if (!event.ctrlKey) {
        if (!event.repeat) void SendQuestion();
        return;
    }

    const input = event.target;
    const { value, selectionStart, selectionEnd, maxLength } = input;
    if (maxLength >= 0 && value.length - (selectionEnd - selectionStart) >= maxLength) {
        return;
    }
    input.setRangeText('\n', selectionStart, selectionEnd, 'end');
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function SendQuestion() {
    if (!canSend.value) return;
    const content = draft.value.trim();
    const files = attachments.value;
    const model = selectedModel.value;
    const history = messages.value.slice(-MAX_TURNS * 2).map(({ role, content, files }) => ({
        role,
        content: Array.from(content || files?.map(file => file.name).join('、') || '').slice(0, MAX_HISTORY_ANSWER).join(''),
    }));
    const controller = new AbortController();
    chatRequest = controller;
    submittedFiles = files;
    error.value = '';
    draft.value = '';
    attachments.value = [];
    messages.value.push({ role: 'user', content, files });
    pending.value = true;
    ScrollToLatest();
    try {
        const rememberedFiles = attachmentContext?.model === model ? attachmentContext.files : [];
        const contextFiles = files.length ? files : rememberedFiles;
        const answer = await api.Ask({ question: content, history, model,
            attachments: contextFiles.map(({ name, text }) => ({ name, text })) }, controller.signal);
        if (chatRequest === controller) {
            attachmentContext = { model, files: contextFiles };
            messages.value.push({ role: 'assistant', content: answer.text });
        }
    } catch (reason) {
        if (chatRequest === controller) {
            messages.value.pop();
            draft.value ||= content;
            attachments.value = files;
            error.value = reason.message || '回答失败，请重试。';
        }
    } finally {
        if (chatRequest === controller) {
            chatRequest = null;
            submittedFiles = [];
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
        attachments.value = submittedFiles;
        submittedFiles = [];
        pending.value = false;
    }
}

function ClearChat() {
    confirmNewChat.value = false;
    StopQuestion();
    attachmentRequest?.abort();
    previewOpen.value = false;
    messages.value = [];
    draft.value = '';
    attachments.value = [];
    attachmentContext = null;
    error.value = '';
}

onActivated(() => {
    void RefreshStatus();
    void ScrollToLatest();
});
onDeactivated(() => {
    confirmNewChat.value = false;
    dragDepth.value = 0;
});
onBeforeUnmount(() => {
    StopQuestion();
    attachmentRequest?.abort();
    statusRequest?.abort();
    testRequest?.abort();
});
</script>

<style scoped>
.assistant-page {
    --assistant-ink: #182848;
    --assistant-accent: #3159ce;
    display: flex;
    flex-direction: column;
    min-height: 560px;
    height: calc(100dvh - 80px);
    max-width: 1560px;
    margin: auto;
    padding: 14px 24px 24px;
    box-sizing: border-box;
    color: var(--assistant-ink);
    border-radius: 18px;
    background:
        radial-gradient(ellipse at 78% 18%, #e5e4ff 0, transparent 49%),
        radial-gradient(ellipse at 15% 72%, #e1f1ff 0, transparent 55%),
        #f4f7fe;
}
.assistant-page.has-chat { background: #fbfcff; }
.assistant-toolbar {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-height: 36px;
    margin-bottom: 8px;
}
.assistant-toolbar .el-button { color: #455779; }
.conversation {
    width: min(100%, 810px);
    min-height: 0;
    flex: 1;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
}
.assistant-greeting {
    margin: clamp(66px, 13vh, 138px) 0 64px;
    text-align: center;
    font-size: clamp(29px, 4.1vw, 44px);
    line-height: 1.22;
    letter-spacing: -0.04em;
}
.assistant-greeting span { color: var(--assistant-accent); }
.messages {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 12px 10px 52px;
    scrollbar-width: thin;
}
.message { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin: 0 0 22px; }
.message.user { align-items: flex-end; margin-bottom: 25px; }
.message-author { display: flex; align-items: center; gap: 8px; font-weight: 650; }
.message-author img { object-fit: contain; }
.message-text { max-width: 100%; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.65; }
.user .message-text { max-width: 88%; padding: 10px 14px; border-radius: 16px 16px 4px 16px; background: #eaf0ff; }
.response-state { color: #536381; margin: 0 0 12px; }
.composer {
    position: relative;
    display: grid;
    flex: none;
    gap: 10px;
    padding: 15px;
    border: 1px solid #cdd9ef;
    border-radius: 22px;
    background: #fff;
    box-shadow: 0 12px 30px rgb(43 66 126 / 9%);
    transition: border-color .16s;
}
.composer:focus-within { border-color: #a0b5e8; }
.composer-avatar {
    position: absolute;
    right: 24px;
    bottom: calc(100% + 3px);
    object-fit: contain;
    filter: drop-shadow(0 5px 9px rgb(64 78 163 / 20%));
    pointer-events: none;
}
.composer :deep(.el-textarea__inner) { padding: 2px 3px; color: var(--assistant-ink); box-shadow: none; background: transparent; line-height: 1.6; }
.composer-actions { display: flex; align-items: center; justify-content: flex-end; gap: 9px; flex-wrap: wrap; }
.composer-actions .el-button { margin-left: 0; }
.composer-spacer { flex: 1; }
.add-button { color: #46618f; background: #f5f8fe; border-color: #dbe4f5; }
.send-button { --el-button-bg-color: #3159ce; --el-button-border-color: #3159ce; }
.model-trigger { max-width: min(42vw, 210px); color: #455779; padding-inline: 8px; }
.model-trigger :deep(> span) { min-width: 0; gap: 6px; }
.model-trigger span[title] { overflow: hidden; text-overflow: ellipsis; }
.file-picker { display: none; }
.chat-files { display: flex; max-width: 100%; flex-wrap: wrap; gap: 8px; }
.user .chat-files { justify-content: flex-end; }
.file-chip {
    max-width: 100%;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    padding: 6px 9px;
    border: 1px solid #dae4f7;
    border-radius: 8px;
    color: #294474;
    background: #f1f5ff;
    overflow-wrap: anywhere;
}
.file-chip span { max-width: 230px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-chip button { cursor: pointer; color: inherit; background: transparent; border: 0; padding: 2px; }
.file-chip .markdown-file { max-width: 230px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-decoration: underline; }
.markdown-preview { max-height: 65vh; overflow: auto; }
.confirm-copy { margin: 0; line-height: 1.6; }
.drop-overlay {
    position: absolute;
    inset: 5px;
    display: grid;
    place-items: center;
    border: 2px dashed #6285e1;
    border-radius: 17px;
    color: #294594;
    font-weight: 600;
    background: rgb(235 241 255 / 96%);
    pointer-events: none;
}
.questions { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 22px; }
.question {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 13px;
    border: 1px solid #dce5f8;
    border-radius: 999px;
    background: rgb(255 255 255 / 70%);
    color: #344b74;
    font: inherit;
    cursor: pointer;
}
.question:hover { border-color: #99afe6; background: #fff; color: #274fbf; }
.model-description { margin: 0; color: #66758a; line-height: 1.6; }
.settings { display: grid; gap: 12px; }
.settings label { display: grid; gap: 5px; }
.settings input, .settings select { padding: 9px; border: 1px solid #d8e2ec; border-radius: 5px; font: inherit; }
.settings-error { color: #a32037; }
@media (max-width: 620px) {
    .assistant-page { height: calc(100dvh - 68px); min-height: 470px; padding: 8px 10px 13px; border-radius: 13px; }
    .assistant-greeting { margin: 66px 0 57px; }
    .composer { padding: 10px; border-radius: 16px; }
    .composer-avatar { width: 72px; height: 57px; right: 12px; }
    .questions { gap: 5px; margin-top: 12px; }
    .question { font-size: 12px; padding: 6px 8px; }
}
</style>
