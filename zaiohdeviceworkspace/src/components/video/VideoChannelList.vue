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
        <div class="video-heading recognition-header">
            <p class="video-subtitle">已配置 {{ workspace.channels.length }} / {{ MAX_VIDEO_CHANNELS }} 路</p>
            <el-button type="primary" :icon="Plus" :disabled="workspace.channels.length >= MAX_VIDEO_CHANNELS" @click="Add">添加通道</el-button>
        </div>
        <div v-if="workspace.channels.length" class="video-channel-filter" aria-label="筛选通道">
            <el-input v-model="keyword" aria-label="搜索通道名称" placeholder="搜索通道名称" :prefix-icon="Search" clearable />
            <el-select v-model="status" aria-label="通道状态">
                <el-option v-for="item in statuses" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
        </div>
        <table v-if="rows.length" class="video-channel-table" role="table" aria-label="已配置通道">
            <thead role="rowgroup">
                <tr role="row">
                    <th scope="col">通道名称</th><th scope="col">视频源</th><th scope="col">算法模型</th><th scope="col">状态</th><th scope="col">操作</th>
                </tr>
            </thead>
            <tbody role="rowgroup">
                <tr v-for="{ channel, names } in rows" :key="channel.id" role="row">
                    <th role="rowheader" scope="row" class="video-channel-name">{{ channel.name }}</th>
                    <td role="cell" class="video-channel-source">{{ VideoSourceName(workspace, channel.source) }}</td>
                    <td role="cell" class="video-channel-models">
                        <div class="video-tags">
                            <el-tag v-for="(name, index) in names" :key="index" size="small" effect="plain">{{ name }}</el-tag>
                        </div>
                    </td>
                    <td role="cell" class="video-channel-state">
                        <el-tag :type="VideoStatusType(channel)" size="small" effect="light">{{ VideoChannelStatus(channel) }}</el-tag>
                    </td>
                    <td role="cell" class="video-channel-actions">
                        <div class="video-actions">
                            <el-button link type="primary" @click="$emit('show-live', channel.id)">预览</el-button>
                            <el-button link type="primary" @click="Edit(channel)">编辑</el-button>
                            <el-button link type="danger" @click="Remove(channel)">删除</el-button>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
        <el-empty v-else :description="workspace.channels.length ? '没有匹配的通道' : '暂无通道，请添加通道'" :image-size="72" />
        <el-dialog v-model="open" :title="creating ? '添加通道' : '编辑通道'" class="channel-settings-dialog" width="min(880px, 94vw)"
            append-to-body destroy-on-close>
            <div v-if="open && editing" class="recognition video-dialog channel-editor">
                <VideoChannelSettings :key="editing.id" :channel="editing" :workspace="workspace" :creating="creating" @saved="Save" @cancel="open = false" />
            </div>
        </el-dialog>
    </section>
</template>

<script setup>
import { computed, ref, shallowRef, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search } from '@element-plus/icons-vue';
import {
    ChannelModels, IsBrowserSource, MakeChannel, MAX_VIDEO_CHANNELS, SaveVideoWorkspace, StartVideoChannel, VideoChannelStatus, VideoSourceName, VideoStatusType
} from '@/demo/video-workspace';
import VideoChannelSettings from './VideoChannelSettings.vue';

const props = defineProps({ workspace: Object, initialChannel: String });
defineEmits(['show-live']);
const open = ref(false);
const creating = ref(false);
const editing = shallowRef(null);

const keyword = ref('');
const status = ref('all');
const statuses = [
    { value: 'all', label: '全部状态' }, { value: 'running', label: '运行中' }, { value: 'stopped', label: '已停止' },
    { value: 'error', label: '输入故障' }, { value: 'browser', label: '浏览器本地输入' }
];
const rows = computed(() => {
    const query = keyword.value.trim().toLowerCase();
    return props.workspace.channels.filter(channel => {
        const state = IsBrowserSource(channel.source) ? 'browser' : channel.state;
        return (status.value === 'all' || state === status.value) && channel.name.toLowerCase().includes(query);
    }).map(channel => ({ channel, names: ModelNames(channel) }));
});

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
        keyword.value = '';
        status.value = 'all';
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

function ModelNames(channel) {
    if (channel.algorithm.mode !== 'model') {
        return [channel.algorithm.mode === 'motion' ? '画面变化检测' : '仅预览'];
    }
    const names = ChannelModels(props.workspace, channel).map(model => model.name);
    return names.length ? names : ['不可用'];
}

watch(() => props.initialChannel, id => {
    const channel = props.workspace.channels.find(item => item.id === id);
    if (channel) {
        Edit(channel);
    }
}, { immediate: true });
</script>
