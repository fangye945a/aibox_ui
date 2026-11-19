<template>
    <section class="recognition monitoring-container">
        <!-- 整机状态 -->
        <template v-if="section === 'device'">
            <div class="video-heading recognition-header">
                <h1>整机状态</h1>
                <el-tag type="info" effect="plain">Mock 演示</el-tag>
            </div>
            <el-tabs v-model="activeTab">
                <el-tab-pane v-for="metric in metrics" :key="metric.type" :label="metric.title" :name="metric.type" />
            </el-tabs>
            <MonitorChartPanel :key="activeTab" :indicator-type="selected.type" :title="selected.title"
                :color="selected.color" :percent="selected.percent || false" :companion="companion" />
            <VideoPerformance :workspace="workspace" />
        </template>
        <!-- 视频诊断 -->
        <template v-else>
            <div class="video-heading recognition-header">
                <h1>视频诊断</h1>
                <el-tag type="info" effect="plain">Mock 演示</el-tag>
            </div>
            <el-radio-group :model-value="channelId" aria-label="诊断通道" @change="SelectChannel">
                <el-radio-button value="">全部通道</el-radio-button>
                <el-radio-button v-for="channel in workspace.channels" :key="channel.id" :value="channel.id">{{ channel.name }}</el-radio-button>
            </el-radio-group>
            <VideoPerformance :workspace="workspace" :channel-id="channelId" analysis @show-live="ShowLive" />
        </template>
    </section>
</template>

<script setup>
import { computed, inject, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MonitorChartPanel from '@/components/MonitorChartPanel.vue';
import VideoPerformance from '@/components/video/VideoPerformance.vue';
import { VIDEO_WORKSPACE } from '@/demo/video-workspace';

const workspace = inject(VIDEO_WORKSPACE);
const route = useRoute();
const router = useRouter();
const section = computed(() => route.query.view === 'video' ? 'video' : 'device');
const channelId = computed(() => workspace.channels.some(item => item.id === route.query.channel) ? route.query.channel : '');

const metrics = [
  {type: 'cpu_usage', title: 'CPU使用率', color: '#1677c8', percent: true, pair: 'memory_used'},
  {type: 'memory_used', title: '内存使用率', color: '#9560ba', percent: true, pair: 'cpu_usage'},
  {type: 'uplink_network', title: '上行网络流量', color: '#168c85', pair: 'downstream_network'},
  {type: 'downstream_network', title: '下行网络流量', color: '#1677c8', pair: 'uplink_network'},
  {type: 'disk_read_rate', title: '磁盘读速率', color: '#518c36', pair: 'disk_write_rate'},
  {type: 'disk_write_rate', title: '磁盘写速率', color: '#b57826', pair: 'disk_read_rate'}
];
const activeTab = ref('cpu_usage');
const selected = computed(() => metrics.find(metric => metric.type === activeTab.value));
const companion = computed(() => metrics.find(metric => metric.type === selected.value.pair));

function SelectChannel(id) {
    const query = { view: 'video' };
    if (id) {
        query.channel = id;
    }
    router.push({ name: 'monitoring', query });
}

function ShowLive(id) {
    router.push({ name: 'videoRecognition', query: { channel: id } });
}
</script>

<style src="@/assets/css/video-workspace.css"></style>
<style scoped>
.monitoring-container { padding: 16px 20px; background: #fff; border-radius: 12px; }
:deep(.el-tabs__item) { height: 46px; font-size: 14px; }
:deep(.el-tabs__nav-wrap::after) { background: #edf1f5; height: 1px; }
@media (max-width: 600px) { .monitoring-container { padding: 12px; } }
</style>
