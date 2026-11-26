<template>
  <div class="sysup-box">
    <p class="sysup-box-title">系统升级</p>
    <img src="@/assets/img/shengji.png" class="shengji-image" alt="">
    <div class="ota-content">
      <div class="sysup-top">
        <img src="@/assets/img/icon.png" alt="">
        <p class="sysup-top-font">上传并校验通过后，设备将自动升级并重启。<br>升级期间请勿断电。</p>
      </div>
      <div class="up-box" :class="{'is-disabled': busy || jobActive}">
        <div class="up-box-center">
          <input ref="fileInput" type="file" accept=".zip" class="files" aria-label="选择升级文件"
                 :disabled="busy || jobActive" @change="selectFile">
          <img src="@/assets/img/xiazai.png" class="center-image" alt="">
          <p class="up-font">{{ selectedFile || upload ? '点击重新选择升级文件' : '点击选择升级文件' }}</p>
        </div>
      </div>
      <template v-if="selectedFile || upload">
        <div class="up-name-de">
          <p class="up-name">{{ upload?.fileName || selectedFile.name }}</p>
          <p class="up-mb">（{{ formatSize(upload?.size || selectedFile.size) }}）</p>
          <el-button v-if="upload" text type="primary" class="no-margin-btn"
                     :disabled="busy || jobActive || upload.status === 'checking'" @click="removeUpload">删除</el-button>
        </div>
        <div class="up-con">
          <div v-if="modifiedTime" class="up-con-row">
            <p class="up-con-left">修改时间</p>
            <p class="up-con-right">{{ modifiedTime }}</p>
          </div>
          <div class="up-con-row">
            <p class="up-con-left">文件大小</p>
            <p class="up-con-right">{{ formatSize(upload?.size || selectedFile.size) }}</p>
          </div>
          <div v-if="upload" class="up-con-row">
            <p class="up-con-left">已上传</p>
            <p class="up-con-right">{{ formatSize(upload.offset) }}</p>
          </div>
        </div>
      </template>
      <div v-if="upload" class="up-progress">
        <div class="up-progress-top">
          <p>上传进度 {{ percentage }}%</p>
          <p v-if="transferSeconds">已用 {{ transferSeconds.toFixed(1) }} 秒</p>
        </div>
        <el-progress :percentage="percentage" :stroke-width="8" :show-text="false" color="#007CF7" />
        <div class="up-progress-details">
          <p v-if="transferSeconds">平均速度 {{ transferMBps.toFixed(2) }} MB/s</p>
          <p v-if="hashPercent > 0 && hashPercent < 100">文件校验 {{ hashPercent }}%</p>
        </div>
      </div>
      <p v-if="message !== '请选择升级文件。'" class="up-status" role="status">{{ message }}</p>
      <div class="up-actions">
        <el-button type="primary" :disabled="busy || confirming || jobActive || (!selectedFile && upload?.status !== 'ready') || upload?.status === 'checking'"
                   @click="startUpload">{{ upload?.status === 'ready' ? '开始升级' : upload?.offset ? '继续上传并升级' : '上传并升级' }}</el-button>
        <el-button v-if="busy" @click="pauseUpload">暂停上传</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import {computed, onBeforeUnmount, onMounted, ref} from 'vue';
import {ElMessage, ElMessageBox} from 'element-plus';
import {otaRequest} from '@/api/ota';

const fileInput = ref(null);
const selectedFile = ref(null);
const upload = ref(null);
const job = ref(null);
const busy = ref(false);
const confirming = ref(false);
const executing = ref(false);
const message = ref('请选择升级文件。');
const hashPercent = ref(0);
const chunkSize = ref(8 * 1024 * 1024);
const transferSeconds = ref(0);
const transferMBps = ref(0);
const phaseNames = {uploading:'上传中', checking:'校验完整性', ready:'校验通过，可以开始升级', validating:'验签及升级准备', reboot_pending:'等待设备完成升级重启', verifying:'核验本轮升级结果', succeeded:'升级成功', failed:'升级失败', unknown:'结果待核对，禁止重复升级'};
const jobActive = computed(() => executing.value || (job.value && !['succeeded','failed'].includes(job.value.status)));
const modifiedTime = computed(() => selectedFile.value ? new Date(selectedFile.value.lastModified).toLocaleString() : '');
const percentage = computed(() => upload.value ? Math.min(100, Math.floor(upload.value.offset * 100 / upload.value.size)) : 0);
let worker = null;
let rejectHash = null;
let controller = null;
let timer = null;
let disposed = false;
let paused = false;
let autoUpgradeRequested = false;

function formatSize(bytes) {
    return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MiB` : `${bytes || 0} B`;
}
function selectFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) { ElMessage.error('请选择 ZIP 格式的升级包'); return; }
    if (upload.value && (file.name !== upload.value.fileName || file.size !== upload.value.size)) {
        ElMessage.error('存在其他上传任务，请先删除任务，或重新选择原文件');
        return;
    }
    selectedFile.value = file;
    hashPercent.value = 0;
    message.value = '文件已选择，点击“上传并升级”开始。';
}
function calculateHash(file) {
    rejectHash?.(new Error("摘要计算已取消"));
    worker?.terminate();
    worker = new Worker(new URL('../workers/ota-hash.js', import.meta.url));
    return new Promise((resolve, reject) => {
        rejectHash = reject;
        worker.onmessage = ({data}) => {
            if (data.progress) hashPercent.value = Math.floor(data.progress * 100 / file.size);
            if (data.error) reject(new Error(data.error));
            if (data.digest) resolve(data.digest);
        };
        worker.onerror = () => reject(new Error('摘要线程执行失败'));
        worker.postMessage(file);
    });
}
async function startUpload() {
    if (busy.value || confirming.value || jobActive.value || (!selectedFile.value && upload.value?.status !== 'ready')) return;
    confirming.value = true;
    try {
        const prompt = upload.value?.status === 'ready' ? '设备将开始升级并自动重启。升级期间请勿断电，是否继续？'
            : '文件上传并校验通过后，设备将自动升级并重启。升级期间请勿断电，是否继续？';
        await ElMessageBox.confirm(prompt, '系统升级', {type: 'warning', confirmButtonText: '继续', cancelButtonText: '取消'});
    } catch {
        return;
    } finally {
        confirming.value = false;
    }
    if (disposed) return;
    autoUpgradeRequested = true;
    if (upload.value?.status === 'ready') {
        await executeUpgrade();
        return;
    }
    busy.value = true;
    paused = false;
    let hashResult;
    try {
        if (!upload.value) {
            upload.value = await otaRequest('/uploads', {method:'POST',body:{fileName:selectedFile.value.name,size:selectedFile.value.size}});
            localStorage.setItem('otaUploadId', upload.value.id);
        }
        chunkSize.value = upload.value.chunkSize || 1024 * 1024;
        // 摘要失败即时转成结果，避免上传期间出现未处理的Promise拒绝。
        hashResult = calculateHash(selectedFile.value).then(digest => ({digest}), error => ({error}));
        const initialOffset = upload.value.offset;
        const started = performance.now();
        while (upload.value.offset < selectedFile.value.size && !paused && !disposed) {
            const offset = upload.value.offset;
            const chunk = selectedFile.value.slice(offset, offset + chunkSize.value);
            for (let attempt = 0; attempt <= 3; attempt++) {
                controller = new AbortController();
                const timeout = setTimeout(() => controller?.abort(), 30000);
                try {
                    upload.value = await otaRequest(`/uploads/${upload.value.id}`, {method:'PUT',headers:{'Upload-Offset':String(offset),'Content-Type':'application/octet-stream'},body:chunk,signal:controller.signal});
                    break;
                } catch (error) {
                    if (paused || disposed || error.status === 401) throw error;
                    upload.value = await otaRequest(`/uploads/${upload.value.id}`);
                    if (upload.value.offset === offset + chunk.size) break;
                    if (upload.value.offset !== offset || attempt === 3) throw error;
                } finally { clearTimeout(timeout); }
            }
            transferSeconds.value = (performance.now() - started) / 1000;
            transferMBps.value = (upload.value.offset - initialOffset) / transferSeconds.value / 1000000;
            message.value = '正在上传升级文件。';
        }
        if (paused || disposed) return;
        const result = await hashResult;
        if (paused || disposed) return;
        if (result.error) throw result.error;
        upload.value = await otaRequest(`/uploads/${upload.value.id}/complete`, {method:'POST',body:{sha256:result.digest}});
        message.value = '上传完成，正在校验完整性。';
        if (upload.value.status === 'ready') await executeUpgrade();
        else schedulePoll();
    } catch (error) {
        message.value = paused ? '上传已暂停，重新选择原文件后可继续。' : error.message;
    } finally {
        busy.value = false;
        worker?.terminate();
        worker = null;
        rejectHash = null;
    }
}
function pauseUpload() {
    paused = true;
    autoUpgradeRequested = false;
    controller?.abort();
    rejectHash?.(new Error("摘要计算已取消"));
    worker?.terminate();
}
async function removeUpload() {
    try {
        await otaRequest(`/uploads/${upload.value.id}`, {method:'DELETE'});
        upload.value = null;
        selectedFile.value = null;
        localStorage.removeItem('otaUploadId');
        if (fileInput.value) fileInput.value.value = '';
        message.value = '上传任务已删除。';
    } catch (error) { message.value = error.message; }
}
async function executeUpgrade() {
    if (!autoUpgradeRequested || upload.value?.status !== 'ready' || jobActive.value) return;
    executing.value = true;
    try {
        job.value = await otaRequest('/execute', {method:'POST',body:{uploadId:upload.value.id}});
        autoUpgradeRequested = false;
        localStorage.setItem('otaJobId',job.value.id);
        message.value = phaseNames[job.value.status];
        schedulePoll();
    } catch (error) {
        message.value = error.message;
        schedulePoll();
    } finally {
        executing.value = false;
    }
}
function schedulePoll() {
    clearTimeout(timer);
    if (!disposed) timer = setTimeout(restore,2000);
}
async function restore() {
    try {
        const jobId = localStorage.getItem('otaJobId');
        if (jobId) {
            job.value = await otaRequest(`/jobs/${jobId}`);
            message.value = job.value.error || phaseNames[job.value.status];
            if (job.value.status === 'succeeded' || job.value.status === 'failed') {
                localStorage.removeItem('otaJobId');
                localStorage.removeItem('otaUploadId');
                upload.value = null;
                selectedFile.value = null;
            } else if (job.value.status !== 'unknown') schedulePoll();
            return;
        }
        const data = await otaRequest('/uploads');
        const id = localStorage.getItem('otaUploadId');
        upload.value = data.uploads.find(item => item.id === id && item.status !== 'consumed') || data.uploads.find(item => ['uploading','checking','ready','executing'].includes(item.status)) || null;
        if (upload.value) {
            localStorage.setItem('otaUploadId',upload.value.id);
            chunkSize.value = upload.value.chunkSize || 1024 * 1024;
            message.value = upload.value.error || phaseNames[upload.value.status] || upload.value.status;
            if (upload.value.status === 'executing') {
                localStorage.setItem('otaJobId', upload.value.id);
                schedulePoll();
            }
            if (upload.value.status === 'checking') schedulePoll();
            if (upload.value.status === 'ready' && autoUpgradeRequested) await executeUpgrade();
        }
    } catch (error) {
        message.value = job.value ? '设备正在重启或连接暂不可用，等待重新连接。' : error.message;
        if (job.value && job.value.status !== 'unknown') schedulePoll();
    }
}
onMounted(restore);
onBeforeUnmount(() => { disposed = true; pauseUpload(); clearTimeout(timer); worker?.terminate(); });
</script>

<style scoped lang="scss">
.sysup-box {
  min-height: 500px;
  height: 100%;
  padding: 10px;
  position: relative;
  background: #fff;
}
.sysup-box-title {
  margin-bottom: 10px;
  font-size: 18px;
  font-weight: bold;
  color: rgba(0, 0, 0, 0.9);
}
.shengji-image {
  position: absolute;
  top: 10px;
  right: 10px;
}
.ota-content {
  position: relative;
  width: 36%;
  min-width: 440px;
  max-width: 760px;
}
.sysup-top {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 12px;
  margin-bottom: 10px;
  border-radius: 6px;
  background: #f0f6fe;
  img {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    margin-top: 2px;
  }
}
.sysup-top-font {
  font-size: 14px;
  line-height: 22px;
  color: rgba(0, 0, 0, 0.9);
}
.up-box {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 150px;
  margin-bottom: 10px;
  border: 1px dashed rgba(0, 124, 247, 0.4);
  border-radius: 8px;
  background: rgba(0, 124, 247, 0.05);
  &.is-disabled {
    opacity: 0.6;
  }
}
.files {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  &:disabled {
    cursor: not-allowed;
  }
}
.up-box-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.center-image {
  width: 60px;
  height: 60px;
  object-fit: contain;
}
.up-font {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.6);
}
.up-name-de {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  font-size: 14px;
  color: #333;
}
.up-name {
  min-width: 0;
  overflow-wrap: anywhere;
}
.up-mb {
  flex-shrink: 0;
}
.no-margin-btn {
  margin: 0;
  padding: 0;
}
.up-con {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 24px;
  border-radius: 8px;
  background: #f2f4f5;
}
.up-con-row {
  display: flex;
  gap: 20px;
  font-size: 14px;
  line-height: 20px;
  color: #333;
}
.up-con-left {
  flex-shrink: 0;
  width: 72px;
}
.up-con-right {
  overflow-wrap: anywhere;
  font-weight: 500;
}
.up-progress {
  padding: 14px 0 4px;
}
.up-progress-top,
.up-progress-details {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  font-size: 14px;
  line-height: 20px;
}
.up-progress-top {
  margin-bottom: 10px;
}
.up-progress-details {
  margin-top: 8px;
  color: #666;
}
.up-status {
  margin: 14px 0;
  font-size: 14px;
  line-height: 22px;
  color: #666;
  overflow-wrap: anywhere;
}
.up-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
  :deep(.el-button + .el-button) {
    margin-left: 0;
  }
}
@media (max-width: 900px) {
  .ota-content {
    width: 100%;
    min-width: 0;
  }
  .shengji-image {
    display: none;
  }
}
</style>
