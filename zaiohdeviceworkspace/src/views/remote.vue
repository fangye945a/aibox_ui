<template>
  <div class="remote-box">
    <div class="remote-box-top">
      <div class="remote-box-top-title">远程桌面</div>
      <div>
        <el-button :loading="connectionState === 'connecting'" @click="loadSettings">重新连接</el-button>
        <el-button :disabled="!remoteUrl" @click="disconnectRemoteDesktop">断开</el-button>
        <el-button @click="toggleFullscreen">
          <el-icon><FullScreen /></el-icon>
          <span class="btn-text">全屏</span>
        </el-button>
      </div>
    </div>
    
    <!-- 连接状态显示 -->
    <div class="connection-status">
      <div class="status-indicator">
        <i class="status-icon" :class="connectionStatusClass"></i>
        <span>{{ connectionStatusText }}</span>
      </div>
      <div class="connection-info">
        <span>服务器: {{ currentSettings.server }}:{{ currentSettings.port }}</span>
        <span>协议: VNC（模拟）</span>
      </div>
    </div>

    <el-alert v-if="connectionError" :title="connectionError" type="error" :closable="false" show-icon />

    <!-- 远程桌面查看器 -->
    <div class="desktop-viewer" ref="desktopViewer">
      <div v-if="!remoteUrl" class="desktop-placeholder">
        <el-icon class="placeholder-icon"><Monitor /></el-icon>
        <p>远程桌面未连接</p>
        <div class="connection-tips">
          <h4>连接提示：</h4>
          <ul>
            <li>点击“重新连接”打开模拟桌面</li>
          </ul>
        </div>
      </div>
      
      <!-- 实际的远程桌面iframe -->
      <iframe 
        v-if="remoteUrl"
        ref="remoteFrame"
        :src="remoteUrl"
        @load="watchDesktopState"
        class="remote-frame"
        title="模拟远程桌面"
        sandbox="allow-same-origin"
        referrerpolicy="no-referrer-when-downgrade">
      </iframe>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, computed, onUnmounted, nextTick } from 'vue';
import { getConfig, connect, disconnect } from '@/api/api.remote';
import { FullScreen, Monitor } from '@element-plus/icons-vue';

const connectionState = ref('disconnected');
const connectionError = ref('');
const remoteUrl = ref('');
const connectionId = ref(null);
const desktopViewer = ref(null);
const remoteFrame = ref(null);
const currentSettings = ref({ server: window.location.hostname, port: 0 });
let stateTimer = null;
let requestGeneration = 0;
let connectionStartedAt = 0;

const connectionStatusClass = computed(() => ({
  'status-connected': connectionState.value === 'connected',
  'status-connecting': connectionState.value === 'connecting',
  'status-disconnected': ['disconnected', 'error'].includes(connectionState.value)
}));
const connectionStatusText = computed(() => ({
  connected: '已连接', connecting: '连接中', disconnected: '未连接', error: '连接失败'
})[connectionState.value]);

const stopStateWatch = () => {
  clearInterval(stateTimer);
  stateTimer = null;
};

// 以noVNC实际握手状态显示连接结果，HTTP接口成功只代表代理准备完成。
const readDesktopState = () => {
  try {
    const doc = remoteFrame.value?.contentDocument;
    if (!doc) {
      return;
    }
    if (doc.documentElement.classList.contains('noVNC_connected')) {
      connectionState.value = 'connected';
      connectionError.value = '';
      return;
    }
    const status = doc.getElementById('noVNC_status');
    const connecting = doc.documentElement.classList.contains('noVNC_connecting') ||
      doc.documentElement.classList.contains('noVNC_reconnecting');
    const credentialDialog = doc.getElementById('noVNC_credentials_dlg');
    if (credentialDialog?.classList.contains('noVNC_open')) {
      connectionState.value = 'connecting';
      connectionError.value = '请在远程桌面窗口中输入VNC认证信息';
      return;
    }
    if ((status?.classList.contains('noVNC_open') && status.classList.contains('noVNC_status_error')) ||
        doc.getElementById('noVNC_connect_dlg')?.classList.contains('noVNC_open')) {
      connectionState.value = 'error';
      connectionError.value = status?.textContent?.trim() || 'VNC连接已断开，请重新连接';
      return;
    }
    if (connectionState.value === 'connected') {
      connectionStartedAt = Date.now();
      connectionState.value = connecting ? 'connecting' : 'disconnected';
    }
    if (connectionState.value === 'connecting' && Date.now() - connectionStartedAt > 30000) {
      connectionState.value = 'error';
      connectionError.value = 'VNC连接超时，请重新连接';
    }
  } catch {
    connectionState.value = 'error';
    connectionError.value = '无法读取远程桌面状态，请重新连接';
  }
};

const watchDesktopState = () => {
  stopStateWatch();
  readDesktopState();
  stateTimer = setInterval(readDesktopState, 500);
};

const loadSettings = async () => {
  const generation = ++requestGeneration;
  stopStateWatch();
  remoteUrl.value = '';
  connectionId.value = null;
  connectionState.value = 'connecting';
  connectionError.value = '';
  connectionStartedAt = Date.now();
  await nextTick();
  try {
    const config = await getConfig();
    if (generation !== requestGeneration) {
      return;
    }
    currentSettings.value = { server: window.location.hostname, ...config.data };
    const response = await connect({
      type: 'vnc', server: currentSettings.value.server, port: currentSettings.value.port
    });
    if (generation !== requestGeneration) {
      return;
    }
    const url = new URL(response.data.url);
    const expected = new URL('./remote-desktop/index.html', window.location.href);
    if (url.href !== expected.href) {
      throw new Error('远程桌面地址无效');
    }
    connectionId.value = response.data.connection_id;
    remoteUrl.value = url.href;
    watchDesktopState();
  } catch (error) {
    if (generation !== requestGeneration) {
      return;
    }
    connectionState.value = 'error';
    connectionError.value = error.message || '远程桌面连接失败';
  }
};

const disconnectRemoteDesktop = async () => {
  ++requestGeneration;
  stopStateWatch();
  remoteUrl.value = '';
  connectionState.value = 'disconnected';
  connectionError.value = '';
  const id = connectionId.value;
  connectionId.value = null;
  if (id) {
    try {
      await disconnect({ connection_id: id });
    } catch (error) {
      connectionError.value = error.message || '断开连接失败';
    }
  }
};

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    desktopViewer.value?.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
};

onMounted(loadSettings);
onUnmounted(() => { disconnectRemoteDesktop(); });
</script>

<style scoped>
.remote-box {
  width: 100%;
  min-height: 80%;
  background-color: #FFFFFF;
  padding: 10px;
  border-radius: 12px;
}

.remote-box-top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 15px;
}

.remote-box-top-title {
  font-size: 18px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
}

.btn-text {
  margin-left: 2px;
}

/* 连接状态 */
.connection-status {
  background: #f8f9fa;
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.status-icon {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-connected {
  background-color: #28a745;
}

.status-connecting {
  background-color: #e6a23c;
}

.status-disconnected {
  background-color: #dc3545;
}

.connection-info {
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: #6c757d;
}

/* 远程桌面查看器 */
.desktop-viewer {
  height: 76vh;
  min-height: 500px;
  background: #000;
  border-radius: 8px;
  position: relative;
  overflow: hidden;
  margin-bottom: 15px;
}

.desktop-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #fff;
  text-align: center;
}

.placeholder-icon {
  font-size: 48px;
  margin-bottom: 16px;
  color: #6c757d;
}

.connection-tips {
  margin-top: 20px;
  text-align: left;
  max-width: 300px;
}

.connection-tips h4 {
  color: #fff;
  margin-bottom: 8px;
}

.connection-tips ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.connection-tips li {
  padding: 4px 0;
  color: #adb5bd;
  position: relative;
  padding-left: 16px;
}

.connection-tips li::before {
  content: '•';
  color: #4facfe;
  position: absolute;
  left: 0;
}

.remote-frame {
  width: 100%;
  height: 100%;
  border: none;
  background: #000;
}


.settings-form {
  padding: 10px 0;
}

</style>
