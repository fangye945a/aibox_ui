<template>
  <section class="video-workspace" aria-labelledby="workspace-page-title">
    <div v-if="error" class="notice error" role="alert">{{ error }}</div>
    <div v-else-if="notice" class="notice" role="status">{{ notice }}</div>

    <VideoLiveGrid v-if="tab === 'live'" v-model="selected" :workspace="workspace" :frames="liveFrames" :busy="busy"
      @control="control" @error="error = $event" />

    <template v-else-if="tab === 'settings'">
      <div class="settings-grid">
        <div class="panel">
          <div class="toolbar split-toolbar">
            <span>已配置 {{ workspace.channels.length }} / 32 路</span>
            <el-button type="primary" :disabled="busy || workspace.channels.length >= 32" @click="edit()">新增通道</el-button>
          </div>
          <p class="edit-rule">修改通道配置前，请先停止该通道的分析。</p>
          <p class="mobile-table-hint">左右滑动查看完整表格</p>
          <div class="video-table-scroll" tabindex="0" role="region" aria-label="通道列表">
          <table>
            <thead><tr><th>通道</th><th>安装位置</th><th>来源</th><th>模型</th><th>状态</th><th>操作</th></tr></thead>
            <tbody><tr v-for="channel in workspace.channels" :key="channel.id">
              <td>{{ channel.name }}</td><td>{{ channel.location || '—' }}</td>
              <td>{{ channel.kind === 'hls' ? '网络视频' : channel.kind.toUpperCase() }}</td><td>{{ channel.models.length }}</td>
              <td><el-tag :type="stateType(workspace.diagnostics[channel.id]?.state)">
                {{ stateLabel(workspace.diagnostics[channel.id]?.state) }}
              </el-tag></td>
              <td class="actions">
                <button :disabled="busy || active(workspace.diagnostics[channel.id])" @click="edit(channel)">编辑</button>
                <button :disabled="busy" @click="control(channel.id, active(workspace.diagnostics[channel.id]) ? 'stop' : 'start')">
                  {{ active(workspace.diagnostics[channel.id]) ? '停止' : '启动' }}
                </button>
                <button :disabled="busy" @click="remove(channel)">删除</button>
              </td>
            </tr></tbody>
          </table>
          </div>
          <p v-if="!workspace.channels.length">暂无通道，请先导入模型并选择视频源。</p>
        </div>
        <form v-if="draft" ref="editorForm" class="panel editor" @submit.prevent="save">
          <h2>{{ draft.id ? '编辑通道' : '新增通道' }}</h2>
          <p v-if="draftLocked" role="status">请先停止该通道的分析，再修改配置。</p>
          <fieldset class="editor-fields" :disabled="draftLocked">
            <label>通道名称<input v-model.trim="draft.name" maxlength="80" required></label>
            <label>安装位置（选填）<input v-model.trim="draft.location" maxlength="80"></label>
            <label>来源类型
              <select v-model="draft.kind" @change="draft.source = ''">
                <option value="mp4">上传 MP4</option><option value="rtsp">RTSP</option><option value="hls">网络视频（MP4 / M3U8）</option><option value="usb">USB 摄像头</option>
              </select>
            </label>
            <template v-if="draft.kind === 'mp4'">
              <label>上传视频<input type="file" accept=".mp4,video/mp4" :disabled="busy" @change="upload"></label>
              <label>视频文件<select v-model="draft.source" required>
                <option value="">请选择</option>
                <option v-for="video in workspace.videos" :key="video.id" :value="video.id">{{ video.name }}</option>
              </select></label>
            </template>
            <label v-else-if="draft.kind === 'rtsp'">RTSP 地址
              <input v-model.trim="draft.source" type="password" autocomplete="off" placeholder="rtsp://主机:端口/路径" required>
            </label>
            <label v-else-if="draft.kind === 'hls'">网络视频地址
              <input v-model.trim="draft.source" type="url" autocomplete="off" placeholder="https://主机/video.mp4 或 https://主机/index.m3u8" required>
            </label>
            <template v-else>
              <el-alert title="双路 USB 摄像头接线要求" :description="usbConnectionHint"
                type="warning" :closable="false" show-icon />
              <label>设备侧摄像头<select v-model="draft.source" required>
                <option value="">请选择</option>
                <option v-for="camera in usbOptions" :key="camera.path" :value="camera.path" :disabled="!!camera.owner">
                  {{ camera.name }} ({{ camera.path }}){{ camera.owner ? ' · 已占用 · ' + camera.owner.name : '' }}
                </option>
              </select></label>
              <p v-if="!workspace.cameras.length">未检测到可采集的 USB 摄像头。</p>
              <p v-if="usbConflict">摄像头已被「{{ usbConflict.name }}」占用，请更换视频源。</p>
            </template>
            <fieldset>
              <legend>检测模型和阈值</legend>
              <div v-for="model in workspace.models" :key="model.id" class="model-option">
                <label><input type="checkbox" :checked="!!setting(model.id)" @change="toggleModel(model.id, $event.target.checked)">{{ model.name }}</label>
                <div v-if="setting(model.id)" class="limits">
                  <label>置信阈值<input v-model.number="setting(model.id).confidence" type="number" min="0" max="1" step="0.01" required></label>
                  <label v-if="model.kind === 'person'">NMS IoU<input v-model.number="setting(model.id).nms" type="number" min="0" max="1" step="0.01" required></label>
                </div>
              </div>
              <router-link v-if="!workspace.models.length" :to="{ query: { view: 'models' } }">前往模型管理</router-link>
            </fieldset>
          </fieldset>
          <div class="actions"><button class="primary" :disabled="busy || draftLocked || !draft.models.length || !!usbConflict" type="submit">保存通道</button>
            <button type="button" :disabled="busy" @click="draft = null">取消</button></div>
        </form>
      </div>
    </template>

    <div v-else-if="tab === 'models'" class="panel">
      <div class="toolbar"><h2>设备模型</h2>
        <label>导入模型 ZIP <input type="file" accept=".zip,application/zip" :disabled="busy" @change="importModel"></label>
        <button @click="cloudOpen = !cloudOpen">云目录</button>
      </div>
      <p v-if="cloudOpen" role="status">云目录未接入</p>
      <p class="mobile-table-hint">左右滑动查看完整表格</p>
      <div class="video-table-scroll" tabindex="0" role="region" aria-label="设备模型列表">
      <table>
        <thead><tr><th>模型</th><th>版本</th><th>类别</th><th>状态</th><th>操作</th></tr></thead>
        <tbody><tr v-for="model in workspace.models" :key="model.id">
          <td>{{ model.name }}</td><td>{{ model.version }}</td><td>{{ model.labels.join(' / ') }}</td>
          <td>板端试加载通过</td><td><button :disabled="busy" @click="exportModel(model)">导出 ZIP</button></td>
        </tr></tbody>
      </table>
      </div>
      <p v-if="!workspace.models.length">暂无设备模型，请导入模型 ZIP。</p>
    </div>

    <div v-else-if="tab === 'records'" class="panel">
      <div class="toolbar">
        <label>通道<select v-model="recordChannel" @change="loadRecords()"><option value="">全部</option>
          <option v-for="channel in workspace.channels" :key="channel.id" :value="channel.id">{{ channel.name }}</option>
        </select></label>
        <label>模型<select v-model="recordModel" @change="loadRecords()"><option value="">全部</option>
          <option v-for="model in workspace.models" :key="model.id" :value="model.id">{{ model.name }}</option>
        </select></label>
        <el-button @click="loadRecords()">刷新</el-button>
      </div>
      <p class="mobile-table-hint">左右滑动查看完整表格</p>
      <div class="video-table-scroll" tabindex="0" role="region" aria-label="检测记录列表">
      <table>
        <thead><tr><th>检测时间</th><th>通道</th><th>模型</th><th>帧</th><th>检测结果</th><th>操作</th></tr></thead>
        <tbody><tr v-for="record in records" :key="record.id">
          <td>{{ new Date(record.capturedAt).toLocaleString() }}</td>
          <td>{{ channelName(record.channel) }}</td><td>{{ modelName(record.model) }}</td><td>{{ record.sequence }}</td>
          <td>{{ record.detections.length }} 项</td>
          <td><el-button link type="primary" @click="showRecord(record)">查看截图</el-button></td>
        </tr></tbody>
      </table>
      </div>
      <p v-if="!records.length">没有匹配的检测记录。</p>
      <div v-else class="actions"><button :disabled="!recordCursor" @click="loadRecords()">第一页</button>
        <button :disabled="records.length < 50" @click="loadRecords(records[records.length - 1].id)">下一页</button></div>
      <el-dialog v-model="reviewOpen" title="检测截图" width="min(850px, calc(100vw - 32px))"
        top="7vh" append-to-body destroy-on-close @close="clearReview">
        <template v-if="review.record">
          <p class="snapshot-meta">
            <span>{{ new Date(review.record.capturedAt).toLocaleString() }}</span>
            <span>{{ channelName(review.record.channel) }}</span>
            <span>{{ modelName(review.record.model) }}</span>
          </p>
          <div v-if="review.image" class="record-snapshot"
            :style="{ width: (review.record.width / review.record.height * 52) + 'vh' }">
            <FramePreview :frame="review.record" :image="review.image" />
          </div>
          <el-alert v-else-if="review.error" :title="review.error" type="error" :closable="false" show-icon />
          <div v-else class="snapshot-loading" role="status">正在加载截图…</div>
        </template>
        <template #footer>
          <el-button @click="reviewOpen = false">关闭</el-button>
        </template>
      </el-dialog>
    </div>

    <div v-else class="panel">
      <p>帧率均取最近 5 秒。总推理耗时包含前处理、NPU 推理和后处理；预览编码单独统计。四宫格最高 960 宽，单路及 APP 最高 1920 宽；检测截图独立按源分辨率编码，最高 2560 宽。无人观看时停止预览编码，因此不会占用分析吞吐。 {{ demoEnabled ? '演示使用模拟画面和诊断数据。' : '' }}</p>
      <p class="mobile-table-hint">左右滑动查看完整表格</p>
      <div class="diagnostics-table" tabindex="0" role="region" aria-label="视频诊断指标">
      <table><thead><tr><th>通道</th><th>运行状态</th><th>预览 FPS</th><th>分析 FPS</th><th>推理帧数</th><th>跳过帧数</th><th>总推理</th><th>NPU 推理</th><th>前处理</th><th>后处理</th><th>预览编码</th><th>重连次数</th><th>错误</th></tr></thead>
        <tbody><tr v-for="channel in workspace.channels" :key="channel.id">
          <td>{{ channel.name }}</td><td>{{ stateLabel(workspace.diagnostics[channel.id]?.state) }}</td>
          <td>{{ fps(workspace.diagnostics[channel.id]?.previewFps) }}</td>
          <td>{{ fps(workspace.diagnostics[channel.id]?.inferenceFps) }}</td>
          <td>{{ workspace.diagnostics[channel.id]?.newFrames ?? 0 }}</td>
          <td>{{ workspace.diagnostics[channel.id]?.droppedFrames ?? 0 }}</td>
          <td>{{ fps(workspace.diagnostics[channel.id]?.inferenceMs) }} ms</td>
          <td>{{ fps(workspace.diagnostics[channel.id]?.npuMs) }} ms</td>
          <td>{{ fps(workspace.diagnostics[channel.id]?.preprocessMs) }} ms</td>
          <td>{{ fps(workspace.diagnostics[channel.id]?.postprocessMs) }} ms</td>
          <td>{{ fps(workspace.diagnostics[channel.id]?.previewMs) }} ms</td>
          <td>{{ workspace.diagnostics[channel.id]?.reconnects ?? 0 }}</td>
          <td>{{ workspace.diagnostics[channel.id]?.error || workspace.diagnostics[channel.id]?.recordError || '—' }}</td>
        </tr></tbody>
      </table>
      </div>
      <h3>USB 摄像头</h3>
      <el-alert title="双路 USB 摄像头接线要求" :description="usbConnectionHint"
        type="warning" :closable="false" show-icon />
      <p v-if="!workspace.cameras.length">未检测到可采集的 USB 摄像头。</p>
      <ul v-else><li v-for="camera in workspace.cameras" :key="camera.path">{{ camera.name }} · {{ camera.path }}</li></ul>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { EventSourcePolyfill } from 'event-source-polyfill';
import { DemoEventSource, demoEnabled } from '@/demo/data';
import { useRoute, useRouter } from 'vue-router';
import FramePreview from '@/components/video/FramePreview.vue';
import VideoLiveGrid from '@/components/video/VideoLiveGrid.vue';
import { active, fps, stateLabel, stateType } from '@/components/video/videoStatus';
import request from '@/config/axios';
import { videoView } from '@/router/videoViews';

const route = useRoute();
const router = useRouter();
const tab = computed(() => videoView(route.query.view).id);
const workspace = ref({ channels: [], models: [], videos: [], diagnostics: {}, cameras: [] });
const liveFrames = ref({});
const selected = ref([]);
const draft = ref(null);
const editorForm = ref(null);
const records = ref([]);
const recordChannel = ref('');
const recordModel = ref('');
const recordCursor = ref(0);
const reviewOpen = ref(false);
const review = ref({ record: null, image: '', error: '' });
const cloudOpen = ref(false);
const notice = ref('');
const error = ref('');
const busy = ref(false);
let snapshotController;
let selectionInitialized = false;
let refreshRequest = 0;
let recordRequest = 0;
let videoEvents;
let videoReconnect;
let reconnectAttempt = 0;
let disposed = false;

const usbConnectionHint = '两路 USB 摄像头请分别接到不同 USB 集线器（Hub）下的端口。同一个 Hub 的不同插口会共享带宽，可能导致第二路无法启动。';
const draftLocked = computed(() => active(workspace.value.diagnostics[draft.value?.id]));
const usbOwners = computed(() => workspace.value.channels.filter(channel => channel.kind === 'usb' && channel.id !== draft.value?.id));
const usbOwner = path => usbOwners.value.find(channel => channel.source === path);
const usbOptions = computed(() => workspace.value.cameras.map(camera => ({ ...camera, owner: usbOwner(camera.path) })));
const usbConflict = computed(() => draft.value?.kind === 'usb' ? usbOwner(draft.value.source) : undefined);
const modelName = id => workspace.value.models.find(model => model.id === id)?.name || id;
const channelName = id => workspace.value.channels.find(channel => channel.id === id)?.name || id;
const api = async (path, options = {}) => (await request({
  url: '/api/video/' + path, silentError: true, ...options
})).data;

function applyWorkspace(value) {
  workspace.value = value;
  if (!selectionInitialized) {
    selected.value = value.channels.slice(0, 4).map(channel => channel.id);
    selectionInitialized = true;
    return;
  }
  const available = new Set(value.channels.map(channel => channel.id));
  const visible = selected.value.filter(id => available.has(id));
  if (visible.length !== selected.value.length) selected.value = visible;
}

async function refresh() {
  const id = ++refreshRequest;
  const value = await api('workspace');
  if (id !== refreshRequest) return;
  applyWorkspace(value);
}

function closeVideoEvents() {
  clearTimeout(videoReconnect);
  videoReconnect = undefined;
  videoEvents?.close();
  videoEvents = undefined;
}

function openVideoEvents() {
  closeVideoEvents();
  const token = localStorage.getItem('loginToken');
  if (disposed || !token) return;
  const connection = demoEnabled ? new DemoEventSource('/api/video/events') : new EventSourcePolyfill('/api/video/events', {
    headers: { Authorization: 'Bearer ' + token },
    heartbeatTimeout: 15000
  });
  videoEvents = connection;
  connection.onopen = () => {
    if (videoEvents !== connection) return;
    reconnectAttempt = 0;
  };
  connection.onmessage = event => {
    if (videoEvents !== connection) return;
    try {
      const payload = JSON.parse(event.data);
      if (payload.workspace) applyWorkspace(payload.workspace);
      liveFrames.value = payload.frames || {};
    } catch {
      // Keep the last complete state and wait for the next event.
    }
  };
  connection.onerror = () => {
    if (videoEvents !== connection) return;
    connection.close();
    videoEvents = undefined;
    const delay = Math.min(8000, 1000 * (2 ** reconnectAttempt));
    reconnectAttempt += 1;
    videoReconnect = setTimeout(openVideoEvents, delay);
  };
}

async function perform(work, message) {
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await work();
    notice.value = message;
    await refresh();
  } catch (problem) {
    error.value = problem.message;
    await refresh().catch(() => {});
  } finally {
    busy.value = false;
  }
}

function control(id, action) {
  return perform(() => api('channels/' + id + '/' + action, { method: 'POST' }),
    action === 'start' ? '通道已开始分析' : '通道已停止');
}

function edit(channel) {
  draft.value = channel ? { location: '', ...JSON.parse(JSON.stringify(channel)) } :
    { id: '', name: '', location: '', kind: 'mp4', source: '', models: [] };
  if (window.matchMedia('(max-width: 767px)').matches) {
    void nextTick(() => editorForm.value?.scrollIntoView({ block: 'start' }));
  }
}

function remove(channel) {
  if (!window.confirm('删除通道“' + channel.name + '”？检测记录将保留。')) return;
  void perform(() => api('channels/' + channel.id, { method: 'DELETE' }), '通道已删除');
}

const setting = id => draft.value.models.find(model => model.id === id);
function toggleModel(id, checked) {
  if (checked) draft.value.models.push({ id, confidence: 0.25, nms: 0.45 });
  else draft.value.models = draft.value.models.filter(model => model.id !== id);
}

function save() {
  if (draftLocked.value) return;
  return perform(async () => {
    const saved = await api('channels', { method: 'PUT', data: draft.value });
    draft.value = null;
    if (!selected.value.includes(saved.id) && selected.value.length < 4) {
      selected.value = [...selected.value, saved.id];
    }
  }, '通道配置已保存');
}

async function upload(event) {
  const input = event.target;
  const file = input.files?.[0];
  if (!file) return;
  await perform(async () => {
    const asset = await api('uploads?name=' + encodeURIComponent(file.name), {
      method: 'POST', data: file, timeout: 180000, headers: { 'Content-Type': 'application/octet-stream' }
    });
    if (draft.value) draft.value.source = asset.id;
  }, '视频已保存在设备');
  input.value = '';
}

async function importModel(event) {
  const input = event.target;
  const file = input.files?.[0];
  if (!file) return;
  await perform(() => api('models', { method: 'POST', data: file, timeout: 90000, headers: { 'Content-Type': 'application/zip' } }),
    '模型已通过板端试加载');
  input.value = '';
}

async function blob(path, signal) {
  return request({ url: '/api/video/' + path, silentError: true, responseType: 'blob', signal });
}

function exportModel(model) {
  return perform(async () => {
    const url = URL.createObjectURL(await blob('models/' + model.id + '/export'));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = model.id + '.zip';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, '已导出模型 ZIP');
}

function clearReview() {
  snapshotController?.abort();
  snapshotController = null;
  review.value = { record: null, image: '', error: '' };
  reviewOpen.value = false;
}

async function showRecord(record) {
  clearReview();
  const controller = new AbortController();
  snapshotController = controller;
  review.value.record = record;
  reviewOpen.value = true;
  try {
    const jpeg = await blob('records/' + record.id + '/preview', controller.signal);
    if (controller.signal.aborted) return;
    const image = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(jpeg);
    });
    if (!controller.signal.aborted) review.value.image = image;
  } catch {
    if (!controller.signal.aborted) review.value.error = '截图加载失败，请关闭后重试。';
  }
}

async function loadRecords(before = 0) {
  clearReview();
  const id = ++recordRequest;
  try {
    const query = new URLSearchParams({ channel: recordChannel.value, model: recordModel.value, before: String(before) });
    const items = await api('records?' + query);
    if (id === recordRequest) {
      records.value = items;
      recordCursor.value = before;
    }
  } catch (problem) {
    error.value = problem.message;
  }
}

watch(tab, view => {
  if (view === 'records') void loadRecords();
  else clearReview();
}, { immediate: true });

onMounted(() => {
  openVideoEvents();
});
onUnmounted(() => {
  disposed = true;
  closeVideoEvents();
  clearReview();
});
</script>

<style scoped>
.video-workspace { --ink: #213448; --muted: #52667d; --line: #dce5ee; max-width: 1600px; margin: auto; color: var(--ink); }
.toolbar, .actions { display: flex; align-items: center; gap: 10px 12px; flex-wrap: wrap; }
.split-toolbar { justify-content: space-between; }
h2, h3, p { margin: 0 0 8px; }
h2 { font-size: 17px; }
h3 { margin-top: 16px; }
p, small { color: var(--muted); }
.panel { background: white; border: 1px solid var(--line); border-radius: 8px; padding: 16px; margin-bottom: 12px; min-width: 0; overflow: auto; }
.settings-grid { display: grid; align-items: start; gap: 12px; grid-template-columns: minmax(0, 2fr) minmax(250px, 1fr); }
.settings-grid > .panel:only-child { grid-column: 1 / -1; }
.toolbar h2 { margin: 0 auto 0 0; }
.error { color: #9f1b38; background: #fff0f1 !important; }
.notice { padding: 9px 12px; background: #e8f5ec; border-radius: 6px; margin-bottom: 12px; }
label { display: inline-flex; gap: 8px; align-items: center; }
.editor { display: grid; align-content: start; gap: 11px; }
.editor-fields { display: grid; gap: 11px; border: 0; padding: 0; margin: 0; }
.editor-fields > label { display: grid; }
.edit-rule { margin: 8px 0 0; }
input, select, button:not(.el-button) { font: inherit; border: 1px solid var(--line); border-radius: 5px; padding: 6px 8px; color: var(--ink); background: white; max-width: 100%; }
input[type=checkbox] { margin: 0; }
button { cursor: pointer; }
button:disabled { cursor: default; opacity: .5; }
.primary { color: white; background: #1466b5; border-color: #1466b5; }
fieldset { min-width: 0; border: 1px solid var(--line); border-radius: 5px; }
.model-option { padding: 4px 0; }
.limits { display: flex; flex-wrap: wrap; gap: 8px; margin: 5px 0; }
.limits input { width: 65px; }
table { width: 100%; border-collapse: collapse; margin: 10px 0; }
.diagnostics-table { overflow-x: auto; }
.diagnostics-table table { min-width: 1260px; }
th, td { text-align: left; border-bottom: 1px solid var(--line); padding: 10px 12px; overflow-wrap: anywhere; }
th { background: #f4f7fb; white-space: nowrap; }
tbody tr:hover { background: #f8fafd; }
.snapshot-meta { display: flex; flex-wrap: wrap; gap: 6px 16px; color: #52667d; margin-bottom: 12px; }
.record-snapshot { max-width: 100%; margin-inline: auto; }
.snapshot-loading { min-height: 160px; display: grid; place-items: center; color: #52667d; }
@media (max-width: 1000px) { .settings-grid { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 620px) { .panel { padding: 12px; } }

@media (max-width: 767px) {
  .video-workspace .panel { padding: 12px; }
  .video-table-scroll { overflow-x: auto; }
  .video-table-scroll table { min-width: 570px; }
  .video-table-scroll td { overflow-wrap: normal; }
  .editor { scroll-margin-top: 12px; }
  .editor input:not([type=checkbox]), .editor select { width: 100%; min-width: 0; font-size: 16px; }
  .editor .limits input { width: 75px; }
  .editor input[type=checkbox] { width: 18px; height: 18px; }
  .editor .model-option > label { min-height: 36px; }
  .editor button, .video-table-scroll .actions button { min-height: 40px; }
  .toolbar label { min-width: 0; flex-wrap: wrap; }
  .toolbar label:has(input[type=file]) { flex-basis: 100%; }
}

</style>
