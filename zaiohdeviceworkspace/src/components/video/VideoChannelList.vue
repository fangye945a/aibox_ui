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
    <section class="video-section" aria-label="通道列表">
        <div class="video-heading">
            <h2>已配置通道 <small>{{ workspace.channels.length }} / {{ MAX_VIDEO_CHANNELS }}</small></h2>
            <el-button type="primary" :icon="Plus" :disabled="workspace.channels.length >= MAX_VIDEO_CHANNELS" @click="Add">添加通道</el-button>
        </div>
        <el-table :data="workspace.channels" row-key="id" empty-text="暂无通道，请添加通道" stripe>
            <el-table-column prop="name" label="通道名称" min-width="125" />
            <el-table-column label="视频源" min-width="150">
                <template #default="{ row }">{{ VideoSourceName(workspace, row.source) }}</template>
            </el-table-column>
            <el-table-column label="算法模型" min-width="130">
                <template #default="{ row }">{{ ModelName(row) }}</template>
            </el-table-column>
            <el-table-column label="状态" min-width="100">
                <template #default="{ row }"><el-tag size="small" effect="plain">{{ VideoChannelStatus(row) }}</el-tag></template>
            </el-table-column>
            <el-table-column label="操作" width="180">
                <template #default="{ row }">
                    <el-button link type="primary" @click="Edit(row)">编辑</el-button>
                    <el-button link type="primary" @click="$emit('show-live', row.id)">预览</el-button>
                    <el-button link type="danger" @click="Remove(row)">删除</el-button>
                </template>
            </el-table-column>
        </el-table>
        <el-dialog v-model="open" :title="creating ? '添加通道' : '编辑通道'" width="min(880px, 94vw)" append-to-body destroy-on-close>
            <div v-if="open && editing" class="recognition video-dialog">
                <VideoChannelSettings :key="editing.id" :channel="editing" :workspace="workspace" :creating="creating" @saved="Save" @cancel="open = false" />
            </div>
        </el-dialog>
    </section>
</template>

<script setup>
import { ref, shallowRef, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import {
    ChannelModels, IsBrowserSource, MakeChannel, MAX_VIDEO_CHANNELS, SaveVideoWorkspace, StartVideoChannel, VideoChannelStatus, VideoSourceName
} from '@/demo/video-workspace';
import VideoChannelSettings from './VideoChannelSettings.vue';

const props = defineProps({ workspace: Object, initialChannel: String });
defineEmits(['show-live']);
const open = ref(false);
const creating = ref(false);
const editing = shallowRef(null);

function Add() {
    const used = new Set(props.workspace.channels.map(item => item.name));
    const name = Array.from({ length: MAX_VIDEO_CHANNELS }, (_, index) => `通道 ${index + 1}`).find(item => !used.has(item));
    const id = Array.from(crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16).padStart(8, '0')).join('');
    editing.value = MakeChannel(id, name, props.workspace.models[0].id);
    creating.value = true;
    open.value = true;
}

function Edit(channel) {
    editing.value = channel;
    creating.value = false;
    open.value = true;
}

function Save(channel) {
    if (creating.value) {
        if (props.workspace.channels.length >= MAX_VIDEO_CHANNELS) {
            ElMessage.warning(`最多配置 ${MAX_VIDEO_CHANNELS} 路通道`);
            return;
        }
        props.workspace.channels.push(channel);
        try {
            SaveVideoWorkspace(props.workspace);
        } catch {
            props.workspace.channels.pop();
            ElMessage.error('无法保存通道配置');
            return;
        }
        const added = props.workspace.channels.at(-1);
        if (added.autostart && !IsBrowserSource(added.source)) {
            StartVideoChannel(props.workspace, added);
        }
        ElMessage.success('通道已添加');
    }
    open.value = false;
}

async function Remove(channel) {
    try {
        await ElMessageBox.confirm(`删除 ${channel.name} 会停止该通道，历史检测记录会保留。`, '删除通道', { type: 'warning' });
    } catch {
        return;
    }
    const index = props.workspace.channels.indexOf(channel);
    props.workspace.channels.splice(index, 1);
    try {
        SaveVideoWorkspace(props.workspace);
        delete props.workspace.timings[channel.id];
        ElMessage.success('通道已删除');
    } catch {
        props.workspace.channels.splice(index, 0, channel);
        ElMessage.error('无法保存通道配置');
    }
}

function ModelName(channel) {
    if (channel.algorithm.mode !== 'model') {
        return channel.algorithm.mode === 'motion' ? '画面变化检测' : '仅预览';
    }
    return ChannelModels(props.workspace, channel).map(model => model.name).join('、') || '不可用';
}

watch(() => props.initialChannel, id => {
    const channel = props.workspace.channels.find(item => item.id === id);
    if (channel) {
        Edit(channel);
    }
}, { immediate: true });
</script>
