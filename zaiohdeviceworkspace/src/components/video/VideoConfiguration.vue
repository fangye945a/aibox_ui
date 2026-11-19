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
    <section class="video-section" aria-label="算法模型资产">
        <div class="video-heading">
            <h2>设备算法模型</h2>
            <div class="video-actions">
                <el-button :icon="Upload" :disabled="busy" @click="fileInput.click()">本地上传</el-button>
                <el-button type="primary" :icon="Download" @click="cloudOpen = true">云平台下载</el-button>
                <input ref="fileInput" type="file" hidden accept=".zip,application/zip" aria-label="上传算法模型 ZIP" @change="UploadPackage" />
            </div>
        </div>
        <div class="video-model-grid">
            <article v-for="model in workspace.models" :key="model.id" class="video-panel video-model-card" :aria-label="model.name">
                <button type="button" class="video-model-summary" @click="Show(model)">
                    <el-icon :size="21"><Box /></el-icon>
                    <span><strong>{{ model.name }}</strong><small>{{ model.target.toUpperCase() }} · v{{ model.version || '1.0.0' }}</small></span>
                    <el-icon><ArrowRight /></el-icon>
                </button>
                <div class="video-tags">
                    <el-tag effect="plain" size="small">{{ model.origin || '内置' }}</el-tag>
                    <el-tag v-for="label in model.labels" :key="label" type="info" size="small">{{ DetectionLabel(label) }}</el-tag>
                </div>
                <div class="video-actions"><el-button link type="primary" @click="Export(model)">导出 ZIP</el-button></div>
            </article>
        </div>
        <el-dialog v-model="cloudOpen" title="云平台算法模型" width="min(750px, 94vw)" append-to-body>
            <div class="recognition video-dialog">
                <p class="video-muted">模拟云目录 · RK3588</p>
                <div class="video-model-grid">
                    <article v-for="model in g_cloudModels" :key="model.id" class="video-panel video-model-card" :aria-label="model.name">
                        <button type="button" class="video-model-summary" @click="Show(model, true)">
                            <el-icon :size="21"><Box /></el-icon>
                            <span><strong>{{ model.name }}</strong><small>{{ model.target.toUpperCase() }} · v{{ model.version }}</small></span>
                            <el-icon><ArrowRight /></el-icon>
                        </button>
                        <div class="video-actions">
                            <el-button size="small" :disabled="busy || Installed(model)" @click="InstallCloud(model)">
                                {{ Installed(model) ? '已下载' : '下载到设备' }}
                            </el-button>
                        </div>
                    </article>
                </div>
            </div>
        </el-dialog>
        <el-dialog v-model="detailOpen" title="算法模型详情" width="min(560px, 94vw)" append-to-body>
            <div v-if="detail" class="recognition video-dialog">
                <h2>{{ detail.name }}</h2>
                <p v-if="detail.description" class="video-muted">{{ detail.description }}</p>
                <dl class="video-fields">
                    <dt>版本</dt><dd>{{ detail.version || '1.0.0' }}</dd>
                    <dt>设备平台</dt><dd>{{ detail.target.toUpperCase() }}</dd>
                    <dt>识别类别</dt><dd>{{ detail.labels.map(DetectionLabel).join('、') }}</dd>
                    <dt>可配参数</dt><dd>{{ parameterLabels[detail.kind] }}</dd>
                    <dt>模型包</dt><dd>{{ detail.demo || detail.status === '内置基线' ? '演示 ZIP' : '算法模型 ZIP' }}</dd>
                    <template v-if="detail.size"><dt>大小</dt><dd>{{ Math.ceil(detail.size / 1024) }} KiB</dd></template>
                    <template v-if="detail.sha256"><dt>SHA-256</dt><dd>{{ detail.sha256 }}</dd></template>
                    <template v-if="!fromCloud"><dt>已绑定通道</dt><dd>{{ BoundChannels(detail.id) }}</dd></template>
                </dl>
            </div>
            <template #footer>
                <el-button v-if="fromCloud && detail" type="primary" :loading="busy" :disabled="Installed(detail)" @click="InstallCloud(detail)">
                    {{ Installed(detail) ? '已下载' : '下载到设备' }}
                </el-button>
                <el-button v-else-if="detail" type="primary" @click="Export(detail)">导出 ZIP</el-button>
            </template>
        </el-dialog>
    </section>
</template>

<script setup>
import { ref, shallowRef } from 'vue';
import { ArrowRight, Box, Download, Upload } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { DetectionLabel, DownloadBlob } from '@/demo/video-recognition';
import { g_cloudModels, LoadModelPackage, MakeDemoModelPackage, ParseModelPackage, StoreModelPackage } from '@/demo/model-packages';
import { SaveVideoWorkspace } from '@/demo/video-workspace';

const props = defineProps({ workspace: Object });
const fileInput = ref(null);
const busy = ref(false);
const cloudOpen = ref(false);
const detailOpen = ref(false);
const fromCloud = ref(false);
const detail = shallowRef(null);
const parameterLabels = { person: '置信度、NMS IoU', yolo26n: '置信度', face: '相似度阈值' };

function Show(model, cloud = false) {
    detail.value = model;
    fromCloud.value = cloud;
    detailOpen.value = true;
}

function Installed(model) {
    return props.workspace.models.some(item => item.catalogId === model.id);
}

function BoundChannels(id) {
    return props.workspace.channels.filter(item => item.algorithm.mode === 'model' && item.modelSettings.some(setting => setting.modelId === id))
        .map(item => item.name).join('、') || '未绑定';
}

async function Install(blob, origin, catalogId) {
    if (busy.value) {
        return;
    }
    busy.value = true;
    try {
        const model = await ParseModelPackage(blob, origin);
        if (props.workspace.models.some(item => item.id === model.id)) {
            ElMessage.info('设备已安装此算法模型');
            return;
        }
        await StoreModelPackage(model.id, blob);
        props.workspace.models.push({ ...model, catalogId });
        try {
            SaveVideoWorkspace(props.workspace);
        } catch (error) {
            props.workspace.models.pop();
            throw error;
        }
        detailOpen.value = false;
        if (catalogId) {
            cloudOpen.value = false;
        }
        ElMessage.success('算法模型已添加到设备');
    } catch (error) {
        ElMessage.error(error.message || '无法导入算法模型');
    } finally {
        busy.value = false;
    }
}

function UploadPackage(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (file) {
        Install(file, '本地上传');
    }
}

function InstallCloud(model) {
    Install(MakeDemoModelPackage(model), '云平台', model.id);
}

async function Export(model) {
    try {
        const blob = model.status === '内置基线' ? MakeDemoModelPackage(model) : await LoadModelPackage(model.id);
        if (!blob) {
            ElMessage.warning('该模型来自旧版演示，请重新上传原始模型包后导出');
            return;
        }
        const filename = model.name.replace(/[\\/:*?"<>|]/g, '_');
        DownloadBlob(blob, `${filename}-${model.version || '1.0.0'}.zip`);
    } catch (error) {
        ElMessage.error(error.message || '无法导出算法模型');
    }
}
</script>
