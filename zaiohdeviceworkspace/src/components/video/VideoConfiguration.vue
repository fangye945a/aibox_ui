<!--
 Copyright (c) 2026 Hunan OpenValley Digital Industry Development Co., Ltd.
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
-->
<template>
    <div v-if="models">
        <section class="video-section" aria-label="模型资产">
            <div class="video-heading">
                <h2>模型资产</h2>
                <el-button :icon="Refresh" @click="RefreshAssets">刷新模型资产</el-button>
            </div>
            <el-form-item label="激活目标通道">
                <el-select v-model="target" aria-label="激活目标通道" :disabled="busy">
                    <el-option v-for="channel in workspace.channels" :key="channel.id" :label="channel.name" :value="channel.id" />
                </el-select>
            </el-form-item>
            <div class="video-columns">
                <article v-for="model in workspace.models" :key="model.id" class="video-panel" :aria-label="model.name">
                    <div class="video-heading"><h3>{{ model.name }}</h3><el-tag type="info" size="small">{{ model.status }}</el-tag></div>
                    <p class="video-muted">{{ model.kind }} · {{ model.target }}</p>
                    <div class="video-tags"><el-tag v-for="label in model.labels" :key="label" size="small">{{ DetectionLabel(label) }}</el-tag></div>
                    <dl class="video-fields">
                        <dt>模型 ID</dt><dd>{{ model.id }}</dd>
                        <dt>SHA-256</dt><dd>{{ model.sha256 ?? '—（模拟基线）' }}</dd>
                        <dt>当前激活</dt><dd>{{ ActiveChannels(model.id) }}</dd>
                    </dl>
                    <el-button size="small" :disabled="busy || !!ActivationReason(model)" @click="Activate(model)">激活到{{ selected.name }}</el-button>
                    <small v-if="ActivationReason(model)" class="video-note">{{ ActivationReason(model) }}</small>
                </article>
            </div>
        </section>
        <section class="video-section video-divider" aria-label="上传 RKNN 模型">
            <div class="video-heading"><h2>上传 RKNN 模型</h2><el-button :disabled="busy" @click="FillExample">填入演示模型</el-button></div>
            <el-form label-position="top" :disabled="busy" @submit.prevent="StageModel">
                <div class="video-columns">
                    <el-form-item label="导入 manifest JSON 文件" for="video-manifest-file">
                        <input id="video-manifest-file" ref="manifestInput" type="file" accept=".json,application/json" :disabled="busy" @change="LoadManifest" />
                    </el-form-item>
                    <el-form-item label="RKNN 文件" for="video-model-file">
                        <input id="video-model-file" ref="modelInput" type="file" accept=".rknn" :disabled="busy" @change="modelFile = $event.target.files[0]" />
                        <span v-if="modelFile" class="video-muted">{{ modelFile.name }}</span>
                    </el-form-item>
                </div>
                <el-form-item label="模型 manifest">
                    <el-input v-model="manifest" aria-label="模型 manifest" type="textarea" :rows="6" maxlength="65536"
                        placeholder="name、kind、target、sha256、contract" />
                </el-form-item>
                <el-button type="primary" native-type="submit" :loading="busy">上传并暂存</el-button>
            </el-form>
        </section>
    </div>
    <div v-else>
        <section class="video-section" aria-label="视频源管理">
            <h2>视频源管理</h2>
            <el-form class="video-filter" label-position="top" @submit.prevent="UploadVideo">
                <el-form-item label="上传 MP4" for="video-upload-file">
                    <input id="video-upload-file" ref="videoInput" type="file" accept=".mp4,video/mp4" required />
                </el-form-item>
                <el-button type="primary" native-type="submit">上传视频</el-button>
            </el-form>
            <p class="video-muted">本地视频保留在当前浏览器页面，离开视频分析后需要重新上传。</p>
            <el-table :data="workspace.sources" stripe>
                <el-table-column label="视频名称" prop="name" min-width="180" />
                <el-table-column label="文件大小" min-width="110">
                    <template #default="{ row }">{{ row.size == null ? '—' : `${(row.size / 1048576).toFixed(2)} MB` }}</template>
                </el-table-column>
                <el-table-column label="上传时间" min-width="175">
                    <template #default="{ row }">{{ row.createdAt == null ? '内置' : DateText(row.createdAt) }}</template>
                </el-table-column>
            </el-table>
        </section>
        <div class="video-columns video-divider">
            <section v-for="channel in workspace.channels" :key="channel.id" class="video-panel" :aria-label="`${channel.name}配置`">
                <div class="video-heading">
                    <h2>{{ channel.name }} · 配置</h2>
                    <el-tag v-if="channel.state === 'stopped'" type="info" size="small">已停止</el-tag>
                    <el-button v-else size="small" @click="Stop(channel)">停止通道</el-button>
                </div>
                <el-form label-position="top" :disabled="channel.state !== 'stopped'" @submit.prevent="SaveChannel(channel)">
                    <el-form-item label="通道名称"><el-input v-model.trim="drafts[channel.id].name" aria-label="通道名称" maxlength="80" required /></el-form-item>
                    <el-checkbox v-model="drafts[channel.id].autostart">打开模块时自动运行</el-checkbox>
                    <p class="video-muted">当前模型：{{ channel.modelId }}</p>
                    <p v-if="channel.state !== 'stopped'" class="video-muted">先停止通道再编辑配置。</p>
                    <el-button type="primary" native-type="submit">保存配置</el-button>
                </el-form>
            </section>
        </div>
    </div>
</template>

<script setup>
import { computed, reactive, ref, shallowRef } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { DateText, DetectionLabel, IsDemoRtspAddress, ModelDetections } from '@/demo/video-recognition';
import { AddVideoSource, ModelLabels, SaveVideoWorkspace } from '@/demo/video-workspace';

const FILE_LIMIT = 64 * 1024 * 1024;
const MANIFEST_LIMIT = 64 * 1024;
const props = defineProps({ workspace: Object, models: Boolean });
const target = ref('person');
const selected = computed(() => props.workspace.channels.find(channel => channel.id === target.value));
const busy = ref(false);
const manifest = ref('');
const modelFile = shallowRef(null);
const manifestInput = ref(null);
const modelInput = ref(null);
const videoInput = ref(null);
const drafts = reactive(Object.fromEntries(props.workspace.channels.map(({ id, name, autostart }) => [id, { name, autostart }])));

function ActiveChannels(id) {
    return props.workspace.channels.filter(channel => channel.modelId === id).map(channel => channel.name).join('、') || '未激活';
}

function ActivationReason(model) {
    const channel = selected.value;
    if (model.kind !== channel.kind || model.target !== 'rk3588') {
        return '模型与所选通道或演示设备不兼容';
    }
    if (channel.modelId === model.id) {
        return '当前通道已激活';
    }
    if (channel.source.type === 'mp4' && !props.workspace.sources.some(source => source.id === channel.source.sourceId)) {
        return '所选通道的视频源不可用';
    }
    if (channel.source.type === 'rtsp' && !IsDemoRtspAddress(channel.source.rtspUrl)) {
        return '所选通道的 RTSP 地址无效';
    }
    return '';
}

function RefreshAssets() {
    ElMessage.success(`模型资产已刷新，共 ${props.workspace.models.length} 项`);
}

async function FileHash(file) {
    const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

function ExpectedContract(kind) {
    const labels = ModelLabels(kind);
    const safety = kind === 'yolo26n';
    return {
        caller_input: { shape: [1, 640, 640, 3], dtype: 'uint8', layout: 'NHWC' },
        preprocess: { color: 'RGB', pad: 114, divisor: 1, resize: 'letterbox' }, labels,
        postprocess: safety ? { layout: 'decoded_xyxy_scores_host_topk', sigmoid: false, nms: false } : { layout: 'split_xywh_score_1x4x8400_1x1x8400' },
        caller_outputs: [
            { name: 'boxes', shape: [1, 4, 8400], dtype: 'float32', layout: 'ND' },
            { name: 'scores', shape: [1, labels.length, 8400], dtype: 'float32', layout: 'ND' }
        ]
    };
}

function MatchesFields(input, expected) {
    return input && Object.entries(expected).every(([key, value]) => Array.isArray(value) ?
        Array.isArray(input[key]) && input[key].length === value.length && value.every((entry, index) => input[key][index] === entry) : input[key] === value);
}

function ValidContract(contract, kind) {
    const { caller_input: input, preprocess, postprocess, labels, caller_outputs: outputs } = ExpectedContract(kind);
    const outputsMatch = Array.isArray(contract?.caller_outputs) && contract.caller_outputs.length === outputs.length &&
        outputs.every(({ shape, dtype }, index) => {
            const actual = contract.caller_outputs[index];
            return MatchesFields(actual, { shape, dtype }) && ['ND', 'NCHW'].includes(actual.layout) &&
                typeof actual.name === 'string' && actual.name.length > 0 && actual.name.length < 256;
        });
    return outputsMatch && MatchesFields(contract, { labels }) && MatchesFields(contract.caller_input, input) &&
        MatchesFields(contract.preprocess, preprocess) && MatchesFields(contract.postprocess, postprocess);
}

async function LoadManifest(event) {
    const file = event.target.files[0];
    if (!file || file.size > MANIFEST_LIMIT) {
        ElMessage.warning('请选择 64 KiB 以内的 manifest JSON 文件');
        return;
    }
    manifest.value = await file.text();
}

async function FillExample() {
    const channel = selected.value;
    const name = channel.kind === 'person' ? 'Person 演示模型' : 'YOLO26n 演示模型';
    const file = new File([`TraceIQ Mock: ${channel.kind}`], `${channel.kind}-demo.rknn`);
    busy.value = true;
    try {
        const hash = await FileHash(file);
        modelFile.value = file;
        manifestInput.value.value = '';
        modelInput.value.value = '';
        manifest.value = JSON.stringify({ name, kind: channel.kind, target: 'rk3588', sha256: hash, contract: ExpectedContract(channel.kind) }, null, 2);
    } catch {
        ElMessage.error('无法生成演示模型');
    } finally {
        busy.value = false;
    }
}

async function StageModel() {
    const file = modelFile.value;
    if (!file || !/\.rknn$/i.test(file.name) || !file.size || file.size > FILE_LIMIT) {
        ElMessage.warning('请选择不超过 64 MiB 的非空 RKNN 文件');
        return;
    }
    busy.value = true;
    try {
        const parsed = JSON.parse(manifest.value);
        if (typeof parsed?.name !== 'string' || !parsed.name.trim() || parsed.name.length > 80 || !['person', 'yolo26n'].includes(parsed.kind) ||
            !/^[a-z0-9_-]{2,32}$/.test(parsed.target ?? '') || !/^[a-f0-9]{64}$/i.test(parsed.sha256 ?? '') || !ValidContract(parsed.contract, parsed.kind)) {
            throw new Error('manifest 字段或模型契约不匹配');
        }
        const hash = await FileHash(file);
        if (hash !== parsed.sha256.toLowerCase()) {
            throw new Error('文件 SHA-256 与 manifest 不一致');
        }
        if (props.workspace.models.some(model => model.sha256 === hash)) {
            throw new Error('该模型已存在');
        }
        props.workspace.models.push({ id: `${parsed.kind}-${hash.slice(0, 16)}`, name: parsed.name.trim(), kind: parsed.kind, target: parsed.target,
            sha256: hash, labels: ModelLabels(parsed.kind), status: '已暂存' });
        SaveVideoWorkspace(props.workspace);
        modelFile.value = null;
        modelInput.value.value = '';
        ElMessage.success('模型已暂存，等待模拟首帧验证');
    } catch (error) {
        ElMessage.error(error instanceof SyntaxError ? 'manifest 不是有效 JSON' : error.message);
    } finally {
        busy.value = false;
    }
}

async function Activate(model) {
    const channel = selected.value;
    if (ActivationReason(model)) {
        return;
    }
    busy.value = true;
    try {
        await new Promise(resolve => setTimeout(resolve, 350));
        const reason = ActivationReason(model);
        if (reason) {
            throw new Error(reason);
        }
        const testFrame = ModelDetections(0, { channelId: channel.id, confidence: 0.01, nmsIou: 0.45 });
        if (!testFrame.length || testFrame.some(item => !model.labels.includes(item.kind))) {
            throw new Error('模拟首帧不符合模型类别契约');
        }
        channel.modelId = model.id;
        if (model.status === '已暂存') {
            model.status = '已验证';
        }
        SaveVideoWorkspace(props.workspace);
        ElMessage.success('模拟首帧验证通过，模型已激活');
    } catch (error) {
        ElMessage.error(error.message);
    } finally {
        busy.value = false;
    }
}

function UploadVideo() {
    const file = videoInput.value.files[0];
    if (!file?.size || !/\.mp4$/i.test(file.name)) {
        ElMessage.warning('请选择非空的 MP4 文件');
        return;
    }
    AddVideoSource(props.workspace, file);
    videoInput.value.value = '';
    ElMessage.success('本地视频已添加');
}

function Stop(channel) {
    channel.state = 'stopped';
    channel.session++;
}

function SaveChannel(channel) {
    const draft = drafts[channel.id];
    if (channel.state !== 'stopped' || !draft.name) {
        return;
    }
    Object.assign(channel, draft);
    SaveVideoWorkspace(props.workspace);
    ElMessage.success('通道配置已保存');
}
</script>
