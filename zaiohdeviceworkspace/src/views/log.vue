<template>
  <div class="log-box">
    <div class="log-box-left">
      <p class="log-box-left-title">日志</p>
      <div class="log-tabs">
        <div
          v-for="tab in tabs"
          :key="tab.id"
          class="log-tab"
          :class="{ 'log-tab-active': activeTab === tab.id }"
          @click="handleTabChange(tab.id)"
        >
          {{ tab.name }}
        </div>
      </div>
    </div>
    <div class="log-box-right">
      <div class="returnBox" v-if="pathStack.length > 0" @click="handleBack">
          <img src='@/assets/img/left.png' class="left-img"/>
          <p  class="returnFont" >返回</p>
      </div>
      <!-- 日志文件查询和异常日志查询 -->
      <div v-if="activeTab === 1 || activeTab === 2">
        <div class="log-top">

          <div class="flex">
            <img src='@/assets/img/icon.png'/>
            <p class="log-top-font">{{ activeTab === 1 ? '提示：若当前路径非实际日志文件的存储路径，请先修改。' : '异常日志列表' }}
              <span v-if="activeTab === 1" class="updateUrl" @click="openPathDialog">修改存储路径</span>
            </p>
          </div>
          <div><el-button type="primary" @click="handleExport()">导出</el-button></div>
        </div>

        <el-table
          ref="tableRef"
          :data="tableData"
          stripe
          style="width: 100%;margin-top: 20px"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="55" />
          <el-table-column prop="name" label="文件名称" >
            <template #default="scope">
              <div class="file-name-container">
                <img
                  v-if="scope.row.type === 'folder'"
                  src='@/assets/img/wjj.png'
                />
                <img
                  v-else-if="scope.row.type === 'file'"
                  src='@/assets/img/wj.png'
                />
              <span
                :class="{ 'folder-name': scope.row.type === 'folder', 'file-name': scope.row.type === 'file' }"
                :style="{ cursor: scope.row.type === 'folder' ? 'pointer' : 'default' }"
                @click="handleItemClick(scope.row)"
              >
                {{ scope.row.name }}
              </span>

              </div>
            </template>
          </el-table-column>
          <el-table-column prop="path" label="路径"  />
          <el-table-column prop="last_modified" label="最新写入时间" />
          <el-table-column label="操作" >
            <template #default="scope">
              <el-button text type="primary" @click="handleView(scope.row)" v-if="scope.row.type === 'file' && true" >查看</el-button>
              <el-button text type="primary" @click="handleExport(scope.row)">导出</el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <el-pagination
          :current-page="pagination.page"
          :page-size="pagination.limit"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
          style="margin-top: 20px; justify-content: flex-end;"
        />
      </div>

      <!-- 日志查看弹窗 -->
      <el-dialog v-model="dialogVisible" :title="activeTab === 1 ? '日志文件内容' : '异常日志内容'" width="50%" :close-on-click-modal="false">
        <div ref="logDialogContentRef" class="log-content">
          <pre>{{ logContent }}</pre>
        </div>
      </el-dialog>

      <!-- 修改存储路径弹窗 -->
      <el-dialog v-model="pathDialogVisible" title="修改存储路径" width="40%" v-if="activeTab === 1">
        <el-form ref="pathFormRef" :model="pathForm" :rules="pathFormRules" label-width="100px">
          <el-form-item label="当前路径地址">
            <el-input v-model="pathForm.log_path" disabled />
          </el-form-item>
          <el-form-item label="新路径地址" prop="newPath">
            <el-input v-model="pathForm.newPath" placeholder="请输入新路径地址" />
          </el-form-item>
        </el-form>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="pathDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="handleSavePath">确认</el-button>
          </span>
        </template>
      </el-dialog>

      <!-- 内核日志分析/系统日志分析 -->
      <template v-else-if="activeTab === 3 || activeTab === 4">
        <div class="log-top-box">
          <div class="flex">
              <el-input class="log-top-box-input" :prefix-icon="Search" v-model="searchInfo.search_text" clearable/>
              <el-tooltip
                :content="buttonType.Cc ? '已启用：过滤条件忽略大小写' : '点击启用：过滤条件将忽略大小写'"
                placement="top"
                effect="light"
              >
                <el-button :class="{ 'active-button': buttonType.Cc }" @mousedown.prevent @click="buttonType.Cc = !buttonType.Cc">
                  Cc
                </el-button>
              </el-tooltip>

              <el-tooltip
                :content="buttonType.regex ? '已启用：使用正则表达式匹配' : '点击启用：使用正则表达式进行匹配'"
                placement="top"
                effect="light"
              >
                <el-button :class="{ 'active-button': buttonType.regex }" @mousedown.prevent @click="buttonType.regex = !buttonType.regex">
                  .*
                </el-button>
              </el-tooltip>
              <el-button type="primary" @click="optStart" v-if="activeTab === 3 && !isRunning">开始</el-button>
              <el-button type="primary" @click="optStart" v-if="activeTab === 4 && !isRunning">开始</el-button>
              <el-button type="primary" @click="optStop"  v-if="activeTab === 3 && isRunning" >停止</el-button>
              <el-button type="primary" @click="optStop"  v-if="activeTab === 4 && isRunning" >停止</el-button>
          </div>
          <div class="flex">
            <el-button type="danger" @click="handleClear">清除</el-button>
            <el-button type="primary" @click="handleExportRealtimeLog">导出</el-button>

          </div>
        </div>

      <div v-loading="logLoading" v-if="activeTab === 3" class="log-container">
          <DynamicScroller
            ref="dmesgLogContentRef"
            class="log-content-box"
            :items="logList"
            :min-item-size="28"
            :buffer="300"
            key-field="id"
            @resize="handleScrollerResize"
          >
            <template #default="{ item, index, active }">
              <DynamicScrollerItem
                :item="item"
                :index="index"
                :active="active"
                :size-dependencies="[item.text]"
                :data-index="index"
                :watch-data="true"
              >
                <div class="log-line">{{ item.text }}</div>
              </DynamicScrollerItem>
            </template>
          </DynamicScroller>

          <!-- 滚动到底部按钮 - 始终显示 -->
          <div
            v-if="activeTab === 3"
            class="scroll-to-bottom-btn"
            @click="scrollToBottom(true)"
          >
            <el-icon><ArrowDown /></el-icon>
          </div>
      </div>
      <div v-loading="logLoading" v-else-if="activeTab === 4" class="log-container">
      <DynamicScroller
        ref="logContentRef"
        class="log-content-box"
        :items="logList"
        :min-item-size="28"
        :buffer="300"
        key-field="id"
        @resize="handleScrollerResize"
      >
        <template #default="{ item, index, active }">
          <DynamicScrollerItem
            :item="item"
            :index="index"
            :active="active"
            :size-dependencies="[item.text]"
            :data-index="index"
            :watch-data="true"
          >
            <div class="log-line">{{ item.text }}</div>
          </DynamicScrollerItem>
        </template>
      </DynamicScroller>

      <!-- 滚动到底部按钮 - 始终显示 -->
      <div
        v-if="activeTab === 4"
        class="scroll-to-bottom-btn"
        @click="scrollToBottom(true)"
      >
        <el-icon><ArrowDown /></el-icon>
      </div>
      </div>
      </template>


    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, watch ,nextTick} from 'vue';
import {EventSourcePolyfill} from 'event-source-polyfill'
import { DemoEventSource, demoEnabled } from '@/demo/data'
import { getList, getView, download, getConfig, setConfig, hilog, dmesg, disconnect, exportRealtimeLog } from "@/api/api.log"
import { Search ,ArrowDown} from '@element-plus/icons-vue'
import { ElMessage} from 'element-plus';
import { onBeforeRouteLeave } from 'vue-router';
const logLoading = ref(false);
const tableRef = ref();
const selectedRows = ref([]);
const pathStack = ref([]);
const exceptionPath = ref('/data/log/faultlog');
let listSequence = 0;
const dialogVisible = ref(false);
const logContent = ref('');
const logDialogContentRef = ref(null); // 日志内容弹窗 ref
const activeTab = ref(1);
const tableData = ref([]);
const pagination = reactive({
  page: 1,
  total: 0,
  limit: 10,
});
const isRunning = ref(false);
const tabs = ref([
  { id: 1, name: '日志文件查询' },
  { id: 2, name: '异常日志查询' },
  { id: 3, name: '内核日志分析' },
  { id: 4, name: '系统日志分析' }
]);
//内核滚动
const logContentRef = ref(null);  // hilog 日志容器 ref
const dmesgLogContentRef = ref(null);  // dmesg 日志容器 ref
const autoScroll = ref(true);
const showScrollToBottom = ref(false);

// SSE 批量接收相关
const sseBuffer = ref([]);  // SSE 数据缓冲区
const sseTimer = ref(null);  // SSE 定时器
const logLineId = ref(0);  // 日志行ID计数器
const BATCH_SIZE = 50;  // 批量大小
const BATCH_INTERVAL = 100;  // 批量间隔(ms)
const MAX_LOG_LINES = 10000;  // 前端最多保留的日志行数
// 路径配置
const pathDialogVisible = ref(false);
const pathFormRef = ref();
const pathForm = reactive({
  log_path: '',
  newPath: ''
});
const pathFormRules = reactive({
  newPath: [
    { required: true, message: '请输入新的存储路径', trigger: 'blur' }
  ]
});


const uuid=()=>{
  var temp_url = URL.createObjectURL(new Blob());
  var uuid = temp_url.toString();
  URL.revokeObjectURL(temp_url);
  return uuid.substr(uuid.lastIndexOf("/") + 1);
}

//查询条件
const searchInfo =reactive({
  type:'',//类型
  search_text:'',
  sseId:uuid()
})
// 按钮状态
const buttonType = reactive({
  Cc: true,
  regex: false
});

// 多选
const handleSelectionChange = (selection) => {
  selectedRows.value = selection;
};
//tab切换
const handleTabChange = (tabId) => {
  optStop();
  listSequence++;
  pathStack.value = [];
  pagination.page = 1;
  activeTab.value = tabId;
  searchInfo.search_text = '';
  if (tableRef.value) {
    tableRef.value.clearSelection();
  }
  if(tabId<3){
    fetchListData().catch(() => {});
  }else{
    logList.value=[];
    logLineId.value = 0;
    sseBuffer.value = [];
  }
  //断开SSE连接
  optStop()
  if (isRunning.value) {
    optStop();
  } else {
    isRunning.value = false; // 确保状态正确
  }
};


// 获取当前日志目录路径
const getCurrentLogDir = () => {
  return activeTab.value === 2 ? exceptionPath.value : pathForm.log_path;
};

// 获取列表数据
const fetchListData = async () => {
  const params = {
    page: pagination.page,
    limit: pagination.limit,
    log_dir: getCurrentLogDir()
  };

  const sequence = ++listSequence;
  const res = await getList(params);
  if (sequence !== listSequence) return;
  if (res.code === 0) {
    tableData.value = res.data.files || [];
    pagination.total = res.data.pagination.total;
    selectedRows.value = [];
  } else {
    ElMessage.error(res.msg || '查询失败');
  }
};

// 查看详情
const handleView = async (row) => {
  try {

  const params = { name: row.name };

  params.log_dir = getCurrentLogDir();

  const res = await getView(params);
  if (res.code === 0) {
     dialogVisible.value = true;
     logContent.value = res.data.content || '暂无内容';
     // 等待DOM更新后重置滚动条到顶部
     await nextTick();
     if (logDialogContentRef.value) {
       logDialogContentRef.value.scrollTop = 0;
     }
  } else {
    ElMessage.error(res.msg || '获取日志内容失败');
  }
  } catch { /* 接口错误由统一请求层提示，表单校验由字段提示。 */ }
};
const getTimestampNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}
// 导出日志文件
const handleExport = async (row) => {
  try {
  const filesToExport = row ? [row] : selectedRows.value;
  if (filesToExport.length === 0) {
    ElMessage.warning('请选择要导出的文件');
    return;
  }
  const downloadParams = {
    log_dir: getCurrentLogDir(),
    list: filesToExport.map(file => ({
      name: file.name,
      type: file.type
    }))
  };
  const deviceId = getdevId() || 'unknown';
  const timestamp = getTimestampNumber();
  const filename = `${deviceId}_${timestamp}_${filesToExport[0].name}${filesToExport.length > 1 || filesToExport[0].type === 'folder' ? '.zip' : ''}`;

  const blob = await download(downloadParams);
  if (blob instanceof Blob) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    ElMessage.success('导出成功');
  } else {
    ElMessage.error('返回数据格式错误');
  }
  } catch { /* 接口错误由统一请求层提示，表单校验由字段提示。 */ }
};
// 导出实时日志内容
const handleExportRealtimeLog = async () => {
  const logType = activeTab.value === 3 ? 'dmesg' : 'hilog';

  try {
    // 调用后端 API 获取完整日志
    const blob = await exportRealtimeLog({ type: logType, id: searchInfo.sseId });

    if (blob instanceof Blob) {
      const deviceId = getdevId() || 'unknown';
      const timestamp = getTimestampNumber();
      const filename = `${deviceId}_${timestamp}_${logType}.log`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      ElMessage.success('导出成功');
    } else {
      ElMessage.error('返回数据格式错误');
    }
  } catch (error) {
    console.error('导出失败:', error);
    ElMessage.error('导出失败: ' + (error.message || '未知错误'));
  }
};
// 文件夹点击
const handleItemClick = (row) => {
  if (row.type === 'folder') {
    pathStack.value.push(getCurrentLogDir());
    const newPath = getCurrentLogDir().endsWith('/')
      ? `${getCurrentLogDir()}${row.name}`
      : `${getCurrentLogDir()}/${row.name}`;
    if (activeTab.value === 2) exceptionPath.value = newPath;
    else pathForm.log_path = newPath;
    pagination.page = 1;  // 重置分页为第1页
    fetchListData().catch(() => {});
  }
};

const handleBack = () => {
  if (pathStack.value.length > 0) {
    const parentPath = pathStack.value.pop();
    if (activeTab.value === 2) exceptionPath.value = parentPath;
    else pathForm.log_path = parentPath;
    pagination.page = 1;  // 重置分页为第1页
    fetchListData().catch(() => {});
  }
};

// 分页
const handleSizeChange = (newSize) => {
  pagination.limit = newSize;
  pagination.page = 1;
  fetchListData();
};

const handleCurrentChange = (newPage) => {
  pagination.page = newPage;
  fetchListData();
};

// 路径配置
const openPathDialog = () => {
  pathDialogVisible.value = true;
  pathForm.newPath = '';
  if (pathFormRef.value) {
    pathFormRef.value.clearValidate();
  }
};

const fetchConfig = async () => {
  const res = await getConfig();
  if (res.code === 0) {
    pathForm.log_path = res.data.log_path;
    fetchListData().catch(() => {});
  } else {
    ElMessage.error(res.msg || '获取配置失败');
  }
};

const handleSavePath = async () => {
  try {
  await pathFormRef.value.validate();
  const res = await setConfig({
    log_path: pathForm.newPath,
    device_id: getdevId() || '',
  });

  if (res.code === 0) {
    ElMessage.success('路径配置保存成功');
    pathDialogVisible.value = false;
    pathForm.log_path = pathForm.newPath;
    pathStack.value = [];
    pagination.page = 1;
    fetchListData().catch(() => {});
  } else {
    ElMessage.error(res.msg || '保存路径配置失败');
  }
  } catch { /* 接口错误由统一请求层提示，表单校验由字段提示。 */ }
};

// 获取设备ID
const getdevId = (() => {
  return localStorage.getItem('device_id_cache') || null;
});
//缓存 正则 区分大小写
const BUTTON_TYPE_KEY = 'log_button_type';
const saveButtonTypeToStorage = () => {
  localStorage.setItem(BUTTON_TYPE_KEY, JSON.stringify(buttonType));
};
const loadButtonTypeFromStorage = () => {
  const savedType = localStorage.getItem(BUTTON_TYPE_KEY);
  if (savedType) {
    Object.assign(buttonType, JSON.parse(savedType));
  }
};

//开始连接
const logList = ref([]);  // 改为数组，每行日志是一个对象 { id: number, text: string }
const optStart = async () => {
  if (buttonType.regex) {
    try { new RegExp(searchInfo.search_text); } catch { ElMessage.error('正则表达式无效，请检查筛选条件'); return; }
  }
  // 先关闭旧的连接
  optStop();

  logLoading.value = true;
  logList.value = [];
  logLineId.value = 0;
  // 清空缓冲区
  sseBuffer.value = [];
  if (sseTimer.value) {
    clearTimeout(sseTimer.value);
    sseTimer.value = null;
  }
  // 启用自动滚动
  autoScroll.value = true;
  showScrollToBottom.value = false;
  if(activeTab.value==3){
     searchInfo.type='dmesg'
  }else{
     searchInfo.type='hilog'
  }
  isRunning.value = true;

  // 设置滚动监听器
  setTimeout(() => {
    setupScrollListener();
  }, 200);

  try {
    await getSSE();
  } catch (error) {
    // 错误处理
    logLoading.value = false;
    ElMessage.error('连接失败');
    isRunning.value = false;
  }
}

//断开连接
const optStop = () => {

  if (eveSource.value) {
    eveSource.value.close()
    eveSource.value = null;
    disconnect({type:searchInfo.type,id:searchInfo.sseId}).catch(() => {})
  }
  // 清理定时器和缓冲区
  if (sseTimer.value) {
    clearTimeout(sseTimer.value);
    sseTimer.value = null;
  }
  sseBuffer.value = [];
  isRunning.value = false;
}

//SSE连接
const eveSource=ref()
const getSSE=()=>{

    // 使用当前访问的地址动态构建 SSE URL
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/api/sse/connect?${new URLSearchParams({type:searchInfo.type,id:searchInfo.sseId,search_text:searchInfo.search_text,ignore_case:String(buttonType.Cc),use_regex:String(buttonType.regex)})}`;
    const eventSource = demoEnabled ? new DemoEventSource(url) : new EventSourcePolyfill(url, {
                        headers: {
                            Authorization:'Bearer '+localStorage.loginToken
                        },
                        withCredentials: true //// 若需携带 Cookie 或认证头
                    });

    eveSource.value=eventSource

    //连接成功回调
    eventSource.onopen=()=>{
       logLoading.value = false;

    }
    //接收消息回调 - 批量接收优化
    eventSource.onmessage=(event)=>{
      // 过滤空数据和纯空白
      const data = event.data.trim();
      if (!data) {
        return;  // 跳过空数据
      }

      // 将数据添加到缓冲区
      sseBuffer.value.push(data);

      // 如果缓冲区达到批量大小，立即刷新
      if (sseBuffer.value.length >= BATCH_SIZE) {
        flushBuffer();
      } else {
        // 否则设置定时器，延迟刷新
        if (sseTimer.value) {
          clearTimeout(sseTimer.value);
        }
        sseTimer.value = setTimeout(() => {
          flushBuffer();
        }, BATCH_INTERVAL);
      }
    };

    // 批量刷新缓冲区数据到 logList
    const flushBuffer = () => {
      if (sseBuffer.value.length === 0) return;

      const newLines = sseBuffer.value.flatMap(text => text.split('\n').filter(Boolean).map(text => ({id:logLineId.value++,text})));
      logList.value.push(...newLines);
      if (logList.value.length > MAX_LOG_LINES) logList.value.splice(0, logList.value.length-MAX_LOG_LINES);
      if (autoScroll.value) nextTick(() => scrollToBottom());

      // 清空缓冲区
      sseBuffer.value = [];
    };

    // 失败后停止本次读取，由用户显式重试，避免拒绝响应触发无界递归重连。
    eventSource.onerror = () => {
      if (eveSource.value !== eventSource) return;
      eventSource.close();
      eveSource.value = null;
      logLoading.value = false;
      isRunning.value = false;
      if (sseTimer.value) clearTimeout(sseTimer.value);
      sseTimer.value = null;
      sseBuffer.value = [];
      ElMessage.error('日志连接已断开，请点击开始重试');
    };

}

// 清除日志内容
const handleClear = () => {
  logList.value = [];
  logLineId.value = 0;
  sseBuffer.value = [];
  autoScroll.value = true;
  showScrollToBottom.value = false;
  ElMessage.success('已清除日志内容');
};
// 监听日志内容变化
watch(logList, async (newVal, oldVal) => {
  // 只对内核日志(dmesg)生效（hilog在SSE回调中已处理）
  if (activeTab.value !== 3) return;

  // 检查数组长度变化
  if (newVal.length !== oldVal.length && autoScroll.value) {
    await nextTick();
    scrollToBottom();
  }
});

// 处理 DynamicScroller 尺寸变化
const handleScrollerResize = () => {
  // DynamicScroller 尺寸变化时，可能需要重新计算布局
  // 同时添加原生滚动事件监听
  setupScrollListener();
};

// 设置原生滚动事件监听（带延迟重试机制）
let setupRetryCount = 0;
const setupScrollListener = (retryCount = 0) => {
  // 清除旧的监听器
  cleanupScrollListener();

  // 根据当前激活的标签页选择对应的 ref
  const currentRef = activeTab.value === 4 ? logContentRef.value : dmesgLogContentRef.value;
  if (!currentRef) {
    retrySetupScrollListener();
    return;
  }

  if (!currentRef.$el) {
    retrySetupScrollListener();
    return;
  }

  // 获取内部滚动容器
  const wrapper = currentRef.$el.querySelector('.vue-recycle-scroller__item-wrapper');
  if (!wrapper) {
    retrySetupScrollListener();
    return;
  }

  // 检查是否已经绑定了事件（避免重复绑定）
  if (currentScrollWrapper.value === wrapper) {
    return;
  }

  // 添加鼠标滚轮事件监听
  wrapper.addEventListener('wheel', handleWheel, { passive: true });
  // 添加滚动事件监听（用于检测用户拖动滚动条）
  wrapper.addEventListener('scroll', handleUserScroll, { passive: true });

  // 保存引用以便后续清理
  currentScrollWrapper.value = wrapper;
  setupRetryCount = 0; // 重置重试计数器
};

// 延迟重试设置滚动监听器
const retrySetupScrollListener = () => {
  if (setupRetryCount < 10) { // 最多重试10次
    setupRetryCount++;
    setTimeout(() => {
      setupScrollListener(setupRetryCount);
    }, 100);
  } else {
    setupRetryCount = 0;
  }
};

// 清除滚动事件监听
const cleanupScrollListener = () => {
  if (currentScrollWrapper.value) {
    currentScrollWrapper.value.removeEventListener('wheel', handleWheel);
    currentScrollWrapper.value.removeEventListener('scroll', handleUserScroll);
    currentScrollWrapper.value = null;
  }
};

// 当前滚动容器的引用
const currentScrollWrapper = ref(null);
// 标志：是否正在执行程序触发的滚动
const isProgrammaticScroll = ref(false);

// 处理鼠标滚轮事件
const handleWheel = (e) => {
  // 如果是程序触发的滚动，不处理用户交互逻辑
  if (isProgrammaticScroll.value) {
    return;
  }

  // 检查是否在日志分析标签页
  if (activeTab.value !== 3 && activeTab.value !== 4) {
    return;
  }

  // 只要有滚轮事件（无论向上还是向下），就停止自动滚动
  if (e.deltaY !== 0) {
    autoScroll.value = false;
  }
};

// 处理用户手动滚动事件（拖动滚动条）
const handleUserScroll = (e) => {
  // 如果是程序触发的滚动，不处理用户交互逻辑
  if (isProgrammaticScroll.value) {
    return;
  }

  // 检查是否在日志分析标签页
  if (activeTab.value !== 3 && activeTab.value !== 4) {
    return;
  }

  // 用户手动拖动滚动条时，停止自动滚动
  autoScroll.value = false;
};
// 路由离开前触发（仅在切换路由时生效）
onBeforeRouteLeave((to, from, next) => {
  // 若当前处于运行状态，触发停止函数
  if (isRunning.value) {
    optStop();
  }
  // 清理滚动监听器
  cleanupScrollListener();
  next();
});

// 组件卸载时清理
onUnmounted(() => {
  optStop();
  listSequence++;
  if (logListChangeTimer) clearTimeout(logListChangeTimer);
  cleanupScrollListener();
});

// 滚动到底部
// force: 是否强制滚动（用于用户点击按钮时）
const scrollToBottom = (force = false) => {
  // 根据当前激活的标签页选择对应的 ref
  const currentRef = activeTab.value === 4 ? logContentRef.value : dmesgLogContentRef.value;
  if (!currentRef || (activeTab.value !== 3 && activeTab.value !== 4)) {
    return;
  }

  // 如果不是强制滚动且自动滚动已关闭，则不滚动
  if (!force && !autoScroll.value) {
    return;
  }

  // 设置程序滚动标志，避免触发用户滚动逻辑
  isProgrammaticScroll.value = true;

  // DynamicScroller 使用 scrollToItem 滚动到最后一个元素
  if (logList.value.length > 0) {
    currentRef.scrollToItem(logList.value.length - 1);
  }

  // 延迟重置标志，等待滚动完成
  setTimeout(() => {
    isProgrammaticScroll.value = false;
  }, 100);

  // 只有强制滚动（用户点击按钮）时才重置 autoScroll
  if (force) {
    autoScroll.value = true;
  }
  showScrollToBottom.value = false;
};
watch(buttonType, saveButtonTypeToStorage, { deep: true });

// 监听 activeTab 变化，设置滚动监听器
watch(activeTab, (newTab) => {
  // 切换到日志分析标签页时，设置滚动监听
  if (newTab === 3 || newTab === 4) {
    // 使用 nextTick 和 setTimeout 确保 DOM 完全渲染
    nextTick(() => {
      setTimeout(() => {
        setupScrollListener();
      }, 100);
    });
  } else {
    // 切换到其他标签页时，清理监听
    cleanupScrollListener();
  }
});

// 监听 logList 变化，设置滚动监听器（使用防抖，避免频繁调用）
let logListChangeTimer = null;
watch(logList, () => {
  if (activeTab.value === 3 || activeTab.value === 4) {
    // 使用防抖，避免 logList 频繁变化时重复设置监听器
    if (logListChangeTimer) clearTimeout(logListChangeTimer);
    logListChangeTimer = setTimeout(() => {
      if (!currentScrollWrapper.value) {
        setupScrollListener();
      }
    }, 200);
  }
});

onMounted(() => {
  loadButtonTypeFromStorage();
  fetchConfig().catch(() => {});

  // 延迟设置滚动监听器，确保 DOM 完全渲染
  setTimeout(() => {
    if (activeTab.value === 3 || activeTab.value === 4) {
      setupScrollListener();
    }
  }, 500);
});


</script>

<style scoped>
.log-box{
  width: 100%;
  height: 100%;
  background: #F2F4F5;
  padding: 10px;
  border-radius: 12px;
  display: flex;
  gap: 10px;
}
.flex{
  display: flex;
}
.log-box-left{
  min-width: 200px;
  border-radius: 4px;
  background: #FFFFFF;
  border-radius: 12px;
}
.log-box-left-title{
  padding: 6px;
  border-bottom: 1px solid #eee;
  margin: 0;
  font-weight: 400;
  font-size: 18px;
  color: #000000;
}
.log-tabs {
  padding: 6px;
}
.log-tab {
  padding: 12px ;
  cursor: pointer;
  transition: all 0.3s;
  border-left: 3px solid transparent;
  font-weight: 400;
  font-size: 14px;
  color: #000000;
}
.log-tab:hover {
  background-color: #f5f7fa;
}
.log-tab-active {
  background-color: #ecf5ff;
  border-left-color: #409eff;
  color: #409eff;
  font-weight: 500;
}
.log-box-right{
  flex: 1;
  min-width: 0;
  background: #FFFFFF;
  padding: 10px;
  border-radius: 12px;
}
.log-top{
  width: 100%;
  background: rgba(240, 246, 254, 1);
  display: flex;
  padding: 6px 12px;
  border-radius: 6px;
  align-items: center;
  justify-content: space-between;
}
.log-top-font{
  font-weight: 400;
  font-size: 14px;
  color: rgba(0,0,0,0.9);
  margin-left: 12px;
  margin-bottom: 0;
  align-items: center;
  display: flex;
}
.updateUrl{
  color: #409eff;
  cursor: pointer
}
:deep(.el-dialog__header.show-close){
  border-bottom:1px solid #eee ;
  margin-bottom:6px ;
}
:deep(.el-dialog__footer){
  border-top:1px solid #eee ;
}
.log-top-box{
  display: flex;
  justify-content: space-between;
  margin-bottom:12px;
}
.log-top-box-input{
  margin-right:12px ;
}
.folder-name {
  text-decoration: underline;
  font-weight: 500;
  color: #409eff;
}
:deep(.el-table) {
  background-color: rgba(242, 244, 245, 1);
  border-radius:8px;
  border: 10px solid rgba(242, 244, 245, 1);
}
:deep(.el-table th) {
  background-color: rgba(0, 124, 247, 0.05);
  color: rgba(0, 0, 0, 0.90);
  font-weight: 500;
  font-size: 14px;
}
:deep(.el-table__cell) {
  background-color: rgba(242, 244, 245, 1);
}
:deep(.el-table--striped .el-table__body tr.el-table__row--striped td.el-table__cell){
   background-color:#FFFFFF ;
}
:deep(.el-table th:first-child) {
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
}
:deep(.el-table th:last-child) {
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
}
:deep(.el-table__body td:first-child) {
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
}

:deep(.el-table__body td:last-child) {
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
}
.returnBox{
  display: inline-flex;
  align-items: center;
  margin-bottom:12px ;
  cursor: pointer;
  padding: 8px 16px;
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
  border-radius: 6px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
}
.returnBox:hover {
  background: linear-gradient(135deg, #337ecc 0%, #409eff 100%);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4);
  transform: translateY(-1px);
}
.left-img{
  width: 16px;
  height: 16px;
  filter: brightness(0) invert(1);
}
.returnFont{
  font-weight: 500;
  font-size: 14px;
  color: #FFFFFF;
  padding-left: 6px;
  margin: 0;
}
.active-button {
  border-color: #007CF7 ;
  color: #007CF7 ;
  background-color: transparent ;
}
.log-container {
  position: relative;
  border-radius: 4px;
  height: calc(100% - 50px);
  display: flex;
  flex-direction: column;
}

.log-content-box {
  height:100%;
  padding: 10px;
  background: #F2F4F5;
  font-weight: 400;
  font-size: 14px;
  color: rgba(0,0,0,0.9);
  position: relative;
}

/* DynamicScroller 内部滚动容器样式 */
:deep(.log-content-box.vue-recycle-scroller) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.log-content-box .vue-recycle-scroller__item-wrapper) {
  height: 100%;
  overflow-y: scroll;
  /* 隐藏滚动条但保持滚动功能 */
  scrollbar-width: none; /* Firefox */
}

:deep(.log-content-box .vue-recycle-scroller__item-wrapper::-webkit-scrollbar) {
  display: none; /* Chrome, Safari, Edge */
  width: 0;
  height: 0;
}

:deep(.log-content-box .vue-recycle-scroller__item-view) {
  padding: 2px 0;
  box-sizing: border-box;
  overflow: hidden;
}

.log-line {
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
  margin: 0;
  line-height: 1.5;
  min-height: 28px;
  overflow: hidden;
}
.log-content {
  max-height: 500px;
  overflow-y: auto;
}

.log-content pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
}
.log-pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  height: 100%;
}
.scroll-to-bottom-btn {
  position: absolute;
  right: 50%;
  bottom: 7%;
  width: 30px;
  height: 30px;
  background: #FFFFFF;
  color: #666;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  z-index: 10;
}

.scroll-to-bottom-btn:hover {
  background: #eee;
  transform: scale(1.1);
}

.file-name-container{
  display: flex;
  align-items: center;
  gap: 8px;
}
:deep(.el-dialog){
  height: 660px;
}
:deep(.el-button--primary.is-text){
  padding-left:0px;
}

</style>
