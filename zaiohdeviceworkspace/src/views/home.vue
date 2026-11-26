<template>
  <div class="home">
      <!-- 首页头部 -->
      <div class="home-top-box">
          <div class="home-top-box-left">
              <img v-if="productImage" :src="productImage" :alt="data.device_info.product_model" class="device-photo">
              <div v-if="data && data.device_info">
                <p class="home-top-box-productModel">在鸿工控机-{{ data.device_info.product_model }}</p>
                <p class="home-top-box-deviceId">设备编号：{{ data.device_info.device_id }}</p>
              </div>
          </div>
          <div class="home-top-box-right">
              <div v-if="data">
                <p class="home-top-box-time">{{ formattedUptime }}</p>
                <p class="home-top-box-timeco">累计运行时间</p>
              </div>
              <el-button type="primary" @click="handleRestart">重启</el-button>
          </div>
      </div>

      <!-- 首页中间 -->
      <div class="home-center-box">
            <div class="home-center-box-left" v-if="data" >
              <div class="memory-bg-container">
                <img :src="data.memory_info.rate >= 80 ? pinkbot : bluebot"
                     class="memory-bg-image"
                     alt="内存背景">
              </div>
              系统内存
              <div class="centerflex">
                <div class="memory-image-container">
                    <canvas ref="memoryBallCanvas" ></canvas>
                    <div v-if="data" class="memory-rate">
                      <span class="memory-number">{{ sseParsedData.memory_used ?? data.memory_info.rate }}</span>
                      <span class="memory-percent">%</span>
                    </div>
                    <div v-if="data" class="memory-status">
                      {{ data.memory_info.rate >= 80 ? '异常' : '正常' }}
                    </div>

                </div>
              </div>
              <div class="centerflex">
                <div class="mar">
                  <p class="home-center-box-left-t">{{ sseParsedData.memory ?? data.memory_info.memory_used }}GB</p>
                  <p class="home-center-box-left-b">已用内存</p>
                </div>
                <div class="mar">
                  <p class="home-center-box-left-t">{{data.memory_info.memory}}GB</p>
                  <p class="home-center-box-left-b">本机内存</p>
                </div>
              </div>

            </div>
            <!-- CPU使用率 -->
            <div class="home-center-box-center">
                <div class="home-center-box-center-top">
                  <div class="betflex">
                    <p class="home-center-box-center-top-title">CPU使用率</p>
                          <p class="home-center-box-center-top-statu" v-if="data">
                            <span class="status-dot"   :class="data.cpu_usage >= 60  ? 'disconnected' : 'connected'"></span>
                            {{ data.cpu_usage >= 60 ? '异常' : '正常' }}
                          </p>
                  </div>
                  <div class="centerflex">
                    <div ref="cpuUsageChart" style="width: 100%; height: 120px;"></div>
                  </div>

                </div>
                <!-- CPU温度 -->
                <div class="home-center-box-center-bottom">
                  <div class="betflex">
                    <p class="home-center-box-center-top-title">CPU温度</p>
                          <p class="home-center-box-center-top-statu" v-if="data">
                            <span class="status-dot" :class="data.cpu_temperature >= 70  ? 'disconnected' : 'connected'"></span>
                            {{ data.cpu_temperature >= 70 ? '异常' : '正常' }}
                          </p>
                  </div>
                  <div class="wdj">
                      <div class="circle-bg" v-if="data" :style="{ backgroundColor: data.cpu_temperature >= 70 ? 'rgba(247, 66, 5, 0.08)' : 'rgba(50, 185, 229, 0.08)' }">
                            <div class="wdjmar">
                                <span class="temperature-value" v-if="data" >{{ sseParsedData.cpu_temperature ?? data.cpu_temperature }}</span>
                                <span class="temperature-unit">℃</span>
                            </div>
                      </div>
                        <img v-if="data" :src="getTemperatureImage(data.cpu_temperature)" class="temperature-icon">
                  </div>
                  </div>
            </div>
            <!-- 存储 -->
            <div class="home-center-box-right">
            <div class="home-center-box-right-top">
                <p class="home-center-box-center-top-title">存储</p>
                <div class="storage-info" v-if="data && data.storage_info">
                    <div class="combined-storage-bar">
                        <div class="storage-bar">
                            <div
                                class="system-segment"
                                :style="{ width: calculatePercentage(storageInfo.systemUsed, storageInfo.total) + '%' }"
                                :title="'系统占用: ' + storageInfo.systemUsed + 'GB'">
                            </div>
                            <div
                                class="used-segment"
                                :style="{ width: calculatePercentage(storageInfo.used, storageInfo.total) + '%' }"
                                :title="'已用存储: ' + storageInfo.used + 'GB'">
                            </div>
                            <div
                                class="available-segment"
                                :style="{ width: calculatePercentage(storageInfo.available, storageInfo.total) + '%' }"
                                :title="'剩余可用: ' + storageInfo.available + 'GB'">
                            </div>
                        </div>
                    </div>
                    <!-- 存储说明 -->
                    <div class="storage-legend">
                        <div class="legend-item">
                            <span class="legend-color system-color"></span>
                            <span class="legend-text">系统占用</span>
                            <span class="legend-value">{{ storageInfo.systemUsed||0 }}GB</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-color used-color"></span>
                            <span class="legend-text">已用存储</span>
                            <span class="legend-value">{{ storageInfo.used||0 }}GB</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-color available-color"></span>
                            <span class="legend-text">剩余可用</span>
                            <span class="legend-value">{{ storageInfo.available||0 }}GB</span>
                        </div>
                    </div>
                </div>
                <div v-else class="no-data-container">
                  <img src="@/assets/img/nodata.png" alt="无扩展存储" class="no-data-image">
                  <p class="no-data-text">暂无数据</p>
                </div>
            </div>
            <p class="hrr"></p>
            <!-- 扩展存储 -->
            <div class="home-center-box-right-bottom">
            <p class="home-center-box-center-top-title">扩展存储</p>
            <div class="storage-info" v-if="data && data.storage_expansion_info">
                <div class="combined-storage-bar">
                    <div class="storage-bar">
                        <div
                            class="used-segment"
                            :style="{ width: calculatePercentage(expansionStorageInfo.used, expansionStorageInfo.total) + '%' }"
                            :title="'已用扩展存储: ' + expansionStorageInfo.used + 'GB'">
                        </div>
                        <div
                            class="available-segment"
                            :style="{ width: calculatePercentage(expansionStorageInfo.available, expansionStorageInfo.total) + '%' }"
                            :title="'剩余可用: ' + expansionStorageInfo.available + 'GB'">
                        </div>
                    </div>
                </div>
                <!-- 扩展存储说明 -->
                <div class="storage-legend">
                    <div class="legend-item">
                        <span class="legend-color used-color"></span>
                        <span class="legend-text">已用存储</span>
                        <span class="legend-value">{{ expansionStorageInfo.used||0 }}GB</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color available-color"></span>
                        <span class="legend-text">剩余可用</span>
                        <span class="legend-value">{{ expansionStorageInfo.available||0 }}GB</span>
                    </div>
                </div>
              </div>
              <div v-else class="no-data-container">
              <img src="@/assets/img/nodata.png" alt="无扩展存储" class="no-data-image">
              <p class="no-data-text">暂无数据</p>
            </div>
            </div>
            </div>

      </div>

      <!-- 首页底部 -->
      <div class="home-bottom-box">
          <div class="home-bottom-box-left">
            <p class="home-bottom-box-left-title">设备基本信息</p>
                <div class="formclass"><p class="formclass-left">产品型号</p><p class="formclass-right" v-if="data">{{data.device_info.product_model}}</p></div>
                <div class="formclass"><p class="formclass-left">设备编号</p><p class="formclass-right" v-if="data">{{data.device_info.device_id}}</p></div>
                <div class="formclass"><p class="formclass-left">系统版本</p><p class="formclass-right" v-if="data">{{data.device_info.system_version}}</p></div>
                <div class="formclass"><p class="formclass-left">运行内存</p><p class="formclass-right" v-if="data">{{data.device_info.memory_type}}</p></div>
                <div class="formclass"><p class="formclass-left">存储大小</p><p class="formclass-right" v-if="data">{{data.device_info.storage}}GB</p></div>
                <div class="formclass"><p class="formclass-left">扩展存储</p><p class="formclass-right" v-if="data">{{data.device_info.storage_expansion}}GB</p></div>
                <div class="formclass"><p class="formclass-left">NPU算力</p><p class="formclass-right" v-if="data">{{data.device_info.compute_power}}TOPS</p></div>
          </div>
              <div class="home-bottom-box-right">
              <div class="network-container" v-if="data && data.network_info">
                <!-- 左右切换按钮 -->
                <div class="network-nav" v-if="data.network_info.length >2">
                <el-button
                  :disabled="currentNetworkIndex === 0"
                  @click="prevNetwork"
                  class="nav-button prev-button"
                >
                  <el-icon><ArrowLeft /></el-icon>
                </el-button>
                <el-button
                  :disabled="currentNetworkIndex >= data.network_info.length - itemsPerPage"
                  @click="nextNetwork"
                  class="nav-button next-button"
                >
                  <el-icon><ArrowRight /></el-icon>
                </el-button>
                </div>

                <!-- 网络数据展示 -->
                <div class="network-item-wrapper">
                  <div
                    v-for="(network, index) in visibleNetworks"
                    :key="index"
                    class="network-item"
                    :class="{ 'single-item': visibleNetworks.length === 1 }"
                  >
                    <p class="home-center-box-center-top-title">
                      {{ network.type === 'wifi' ? 'WiFi' : '以太网' }}
                    </p>
                    <div class="home-bottom-box-right-one">
                      <div class="network-image-container">
                        <img :src="network.type === 'wifi' ? wangluof : wangluo">
                      </div>
                      <div class="pdflex">
                        <p class="home-bottom-box-right-one-left">连接状态</p>
                        <p class="home-bottom-box-right-one-right" :class="network.status === 1 ? 'connected-font' : 'disconnected-font'">
                          {{ network.status === 1 ? '已连接' : '未连接' }}
                        </p>
                      </div>
                      <div class="pdflex">
                        <p class="home-bottom-box-right-one-left">以太网接口</p>
                        <p class="home-bottom-box-right-one-right">{{ network.interface }}</p>
                      </div>
                      <div class="pdflex">
                        <p class="home-bottom-box-right-one-left">IP地址</p>
                        <p class="home-bottom-box-right-one-right">{{ network.IP }}</p>
                      </div>
                      <div class="pdflex">
                        <p class="home-bottom-box-right-one-left">网关</p>
                        <p class="home-bottom-box-right-one-right">{{ network.gateway }}</p>
                      </div>
                      <div class="pdflex">
                        <p class="home-bottom-box-right-one-left">子网掩码</p>
                        <p class="home-bottom-box-right-one-right">{{ network.subnet_mask }}</p>
                      </div>
                      <div class="pdflex">
                        <p class="home-bottom-box-right-one-left">DNS</p>
                        <p class="home-bottom-box-right-one-right">{{ network.DNS }}</p>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
      <!-- 重启确认弹窗 -->
      <el-dialog
      v-model="restartDialogVisible"
      title="重启"
      width="36%"
      :before-close="handleClose"
      >
      <div style="padding: 10px 0;">
        <p style="font-weight: 400;font-size: 14px;color: rgba(0,0,0,0.9);">
          确定要重启设备吗？重启过程中页面功能将无法使用。
        </p>
      </div>

      <template #footer>
        <span>
          <el-button @click="restartDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmRestart">重启</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>
<script setup>
import {EventSourcePolyfill} from 'event-source-polyfill'
import { DemoEventSource, demoEnabled } from '@/demo/data'
import { onBeforeRouteLeave } from 'vue-router';
import { disconnect} from "@/api/api.log"
import { getInfo ,restart} from "@/api/api.home";
import { ref, shallowRef, onMounted, watch ,computed ,onUnmounted, reactive} from 'vue';
import * as echarts from 'echarts';
import { ElMessage } from 'element-plus'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { Clock } from '@element-plus/icons-vue'
import { getProductImage } from '@/utils/product-image';
import wdjf from '@/assets/img/wdjf.png';
import wdjt from '@/assets/img/wdjt.png';
import yuanf from '@/assets/img/yuanf.png';
import yuant from '@/assets/img/yuant.png';
import wangluo from '@/assets/img/wangluo.png';
import wangluof from '@/assets/img/wangluof.png';
import pinkbot from '@/assets/img/pinkbot.png';
import bluebot from '@/assets/img/bluebot.png';
const data = ref(null);
const cpuUsageChart = ref(null);
let cpuChartInstance = null;
const resizeCPU = () => cpuChartInstance?.resize();
const restartDialogVisible = ref(false);
const currentNetworkIndex = ref(0);
const itemsPerPage = 2; // 每页显示的网络数量
const sseParsedData = ref({});
// 使用设备实时运行时间，避免后台标签页定时器降频或休眠造成累计偏差。
const uptimeSeconds = ref(null)
let lastStatusAt = 0
let statusWatchdog = null
let pageActive = false
let recoveryPending = false
let recoveryAt = 0
// 球体变量
const memoryBallCanvas = ref(null);
const memoryBallCtx = ref(null);
let memoryBallAnimationId = null;
// 初始化球体
const initMemoryBall = () => {
  if (!memoryBallCanvas.value || !data.value) return;
  memoryBallCanvas.value.width = 180;
  memoryBallCanvas.value.height = 180;
  memoryBallCtx.value = memoryBallCanvas.value.getContext('2d');
  if (memoryBallAnimationId) cancelAnimationFrame(memoryBallAnimationId);
  drawMemoryBall();
};

// 绘制球体
const drawMemoryBall = () => {
  if (!memoryBallCtx.value || !data.value) return;
  const canvas = memoryBallCanvas.value;
  const ctx = memoryBallCtx.value;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = 70;
  const usage = data.value.memory_info.rate;

  // 球体颜色配置
  const isHighUsage = usage >= 80;
  const borderColor = isHighUsage ? 'rgba(245, 108, 108, 0.2)' : 'rgba(0, 124, 247, 0.2)';
  const bgColor = isHighUsage ? 'rgba(245, 108, 108, 0.3)' : 'rgba(0, 124, 247, 0.3)';
  const waveGradientStart = isHighUsage ? 'rgba(245, 108, 108, 1)' : 'rgba(0, 124, 247, 1)';
  const waveGradientEnd = isHighUsage ? 'rgba(245, 108, 108, 0.6)' : 'rgba(0, 124, 247, 0.6)';
  const fillColor = isHighUsage ? 'rgba(245, 108, 108, 0.28)' : 'rgba(0, 124, 247, 0.28)';

  // 清除画布
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 绘制圆形边框
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 0.1;
  ctx.stroke();

  // 进入剪切区域
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius - 2, 0, Math.PI * 2);
  ctx.clip();

  // 填充整个圆形背景色
  ctx.fillStyle = fillColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 计算液体高度
  const liquidHeight = canvas.height - (usage / 100) * canvas.height;

  // 绘制液体背景
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, liquidHeight, canvas.width, canvas.height);

  // 波浪动画
  const waveOffset = Date.now() / 1000;
  ctx.beginPath();
  ctx.moveTo(0, liquidHeight + Math.sin(waveOffset) * 5);

  for (let x = 0; x <= canvas.width; x += 10) {
    const y = liquidHeight + Math.sin(x * 0.05 + waveOffset) * 5;
    ctx.lineTo(x, y);
  }

  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.closePath();

  // 液体渐变
  const gradient = ctx.createLinearGradient(0, liquidHeight, 0, canvas.height);
  gradient.addColorStop(0, waveGradientStart);
  gradient.addColorStop(1, waveGradientEnd);
  ctx.fillStyle = gradient;
  ctx.fill();
    // 主高光
  ctx.save();
  ctx.beginPath();

  // 变换坐标系以绘制椭圆形高光
  ctx.translate(centerX - radius * 0.16, centerY - radius * 0.6);
  ctx.scale(2.8, 1);

  const highlightGradient = ctx.createRadialGradient(
    0, 0, 0,
    0, 0, radius * 0.2
  );
  highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
  highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.arc(0, 0, radius * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = highlightGradient;
  ctx.fill();
  ctx.restore();

  // 边缘反光
  ctx.save();
  ctx.beginPath();
  ctx.translate(centerX + radius * 0.6, centerY - radius * 0.4);
  ctx.scale(1.8, 2.5);
  const edgeHighlightGradient = ctx.createRadialGradient(
    0, 0, 0,
    0, 0, radius * 0.15
  );
  edgeHighlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
  edgeHighlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.arc(0, 0, radius * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = edgeHighlightGradient;
  ctx.fill();
  ctx.restore();
  // 恢复绘图状态
  ctx.restore();

  // 动画循环
  memoryBallAnimationId = requestAnimationFrame(drawMemoryBall);
};
// 格式化运行时间
const formattedUptime = computed(() => {
    if (uptimeSeconds.value === null) return '--'
    const seconds = Math.floor(uptimeSeconds.value)
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    let result = []
    if (hours > 0) result.push(`${hours}小时`)
    if (minutes > 0) result.push(`${minutes}分钟`)
    result.push(`${secs}秒`)

    return result.join(' ')
})

// 计算当前可见的网络数据
const visibleNetworks = computed(() => {
  if (!data.value?.network_info) return [];
  return data.value.network_info.slice(
    currentNetworkIndex.value,
    currentNetworkIndex.value + itemsPerPage
  );
});

// 切换到上一个网络
const prevNetwork = () => {
  if (currentNetworkIndex.value > 0) {
    currentNetworkIndex.value -= itemsPerPage;
  }
};

// 切换到下一个网络
const nextNetwork = () => {
  if (currentNetworkIndex.value + itemsPerPage < data.value.network_info.length) {
    currentNetworkIndex.value += itemsPerPage;
  }
};
// 重启点击
const handleRestart = () => {
  restartDialogVisible.value = true;
};
// 确认重启
const confirmRestart = async () => {
  try {
    const res = await restart();
    ElMessage.success(res.msg || '重启成功');
    restartDialogVisible.value = false;
  } catch (error) {ElMessage.error(error.message || '未知错误');}
};
// 弹窗关闭
const handleClose = (done) => {
  restartDialogVisible.value = false;
};
//获取数据
const fetchData = async () => {
  try {
    const response = await getInfo();
    if (!pageActive) return false;
    data.value = response.data;
    if (Number.isFinite(response.data.boot_time) && response.data.boot_time >= 0) {
      uptimeSeconds.value = response.data.boot_time;
      lastStatusAt = Date.now();
    }
    if (data.value && data.value.device_info && data.value.device_info.device_id) {
      setDeviceIdToCache(data.value.device_info.device_id);
    }
    return true;
  } catch (err) {
    uptimeSeconds.value = null;
    console.error(err);
    return false;
  }
};

const getTemperatureImage = (temp) => {
  if (temp < 70) return wdjt;
  return wdjf;
};

// 计算存储信息
const storageInfo = computed(() => {
  if (!data.value || !data.value.storage_info) return {
    systemUsed: 0,
    used: 0,
    available: 0,
    total: 0
  };
  return {
    systemUsed: parseFloat(data.value.storage_info.storage_system_used) ,
    used: parseFloat(data.value.storage_info.storage_used) ,
    available: parseFloat(data.value.storage_info.storage_can_used),
    total: parseFloat(data.value.storage_info.storage)
  };
});
// 计算扩展存储信息
const expansionStorageInfo = computed(() => {
  if (!data.value || !data.value.storage_expansion_info) return {
    used: 0,
    available: 0,
    total: 0
  };
  return {
    used: parseFloat(data.value.storage_expansion_info.storage_expansion_used),
    available: parseFloat(data.value.storage_expansion_info.storage_expansion_can_used),
    total: parseFloat(data.value.storage_expansion_info.storage_expansion)
  };
});
// 计算百分比
const calculatePercentage = (value, total) => {
  if (!total) return 0;
  return Math.round((value / total) * 100);
};
// 根据rate获取颜色
const getMemoryColor = (rate) => {
  if (rate >= 70) return '#F56C6C';
  return '#409EFF';
};

// CPU使用率图表
const initCpuUsageChart = () => {
  if (!cpuUsageChart.value || !data.value) return;

  const usage = sseParsedData.value.cpu_usage ?? data.value.cpu_usage;
  const color = getMemoryColor(usage);
  const chart = cpuChartInstance || echarts.init(cpuUsageChart.value);
  if (!cpuChartInstance) window.addEventListener('resize', resizeCPU);
  cpuChartInstance = chart;


  const option = {
    textStyle: {fontFamily: getComputedStyle(document.body).fontFamily},
    series: [{
      type: 'gauge',
      startAngle: 180,
      endAngle: 0,
      min: 0,
      max: 100,
      radius: '100%',
      center: ['50%', '70%'],
      pointer: {
        show: true,
        length: '36%',
        width: 6,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              {
                offset: 0,
                color: '#4A90E2'
              },
              {
                offset: 1,
                color: '#1565C0'
              }
            ]
          }
        }
      },
      anchor: {
        show: true,
        size: 3,
        showAbove: true,
        itemStyle: {
          color: '#FFFFFF',
          borderWidth: 0,
          shadowBlur: 0
        }
      },
      progress: {
        show: true,
        roundCap: true,
        width: 12,
        itemStyle: {
          color: color
        }
      },
      axisLine: {
        roundCap: true,
        lineStyle: {
          width: 15,
          color: [[1, '#eee']]
        }
      },
      axisTick: {
        show: false
      },
      splitLine: {
        show: true,
        length: 6,
        lineStyle: {
          color: '#666',
          width: 0.6
        }
      },
      axisLabel: {
        show: false
      },
      detail: {
        valueAnimation: false,
        fontSize: 24,
        fontWeight: 'bold',
        color: 'black',
        formatter: '{value}%',
        offsetCenter: ['-76%', '-120%']
      },
      data: [{
        value: usage||0
      }]
    }]
  };

  chart.setOption(option);

}

const DEVICE_ID_CACHE_KEY = 'device_id_cache';
const deviceIdCache = ref('');
const setDeviceIdToCache = (deviceId) => {
  if (deviceId) {
      localStorage.setItem(DEVICE_ID_CACHE_KEY, deviceId);
      deviceIdCache.value = deviceId;
  }
};

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
// 停止旧连接；连接序号检查避免迟到回调覆盖新状态。
const eveSource = shallowRef(null);
const optStop = () => {
  if (eveSource.value) {
    eveSource.value.close();
    eveSource.value = null;
    if (navigator.onLine && localStorage.getItem('loginToken')) {
      disconnect({type: 'runningStatus', id: searchInfo.sseId}).catch(() => {});
    }
  }
};
const optStart = () => {
  if (!pageActive || !localStorage.getItem('loginToken')) return;
  optStop();
  searchInfo.type = 'runningStatus';
  searchInfo.sseId = uuid();
  lastStatusAt = Date.now();
  const eventSource = demoEnabled ?
    new DemoEventSource(`${window.location.origin}/api/sse/connect?type=runningStatus&id=${searchInfo.sseId}`) :
    new EventSourcePolyfill(`${window.location.origin}/api/sse/connect?type=runningStatus&id=${searchInfo.sseId}`, {
      headers: {Authorization: 'Bearer ' + localStorage.getItem('loginToken')},
      withCredentials: true
    });
  eveSource.value = eventSource;
  eventSource.onmessage = (event) => {
    if (!pageActive || eveSource.value !== eventSource || !event.data?.trim()) return;
    try {
      const status = JSON.parse(event.data);
      if (!Number.isFinite(status.boot_time) || status.boot_time < 0) return;
      lastStatusAt = Date.now();
      uptimeSeconds.value = status.boot_time;
      sseParsedData.value = status;
    } catch (error) {
      console.error('Invalid running status response', error);
    }
  };
  eventSource.onerror = () => {
    if (!pageActive || eveSource.value !== eventSource) return;
    eventSource.close();
    eveSource.value = null;
    if (Date.now() - lastStatusAt > 10000) uptimeSeconds.value = null;
    recoverStatus();
  };
};
// 普通HTTP校准同时校验会话；401由统一请求层退出登录，SSE不无限重试失效令牌。
const recoverStatus = async () => {
  if (!pageActive || !navigator.onLine || recoveryPending || Date.now() - recoveryAt < 5000) return;
  recoveryPending = true;
  recoveryAt = Date.now();
  try {
    const available = await fetchData();
    if (available && pageActive && localStorage.getItem('loginToken')) optStart();
  } finally {
    recoveryPending = false;
  }
};
const resumeStatus = () => {
  if (document.visibilityState === 'hidden') return;
  lastStatusAt = 0;
  recoverStatus();
};
const pauseStatus = () => {
  optStop();
  uptimeSeconds.value = null;
  lastStatusAt = 0;
};
const stopStatus = () => {
  pageActive = false;
  clearInterval(statusWatchdog);
  document.removeEventListener('visibilitychange', resumeStatus);
  window.removeEventListener('online', resumeStatus);
  window.removeEventListener('offline', pauseStatus);
  optStop();
};
// 路由离开前触发（仅在切换路由时生效）
onBeforeRouteLeave((to, from, next) => {
    stopStatus();
  next();
});

// 数据变化监听
watch(data, () => {
    if (cpuUsageChart.value) initCpuUsageChart()
    initMemoryBall();
})

watch(sseParsedData, () => {
   initCpuUsageChart()
})

onMounted(async () => {
  pageActive = true;
  document.addEventListener('visibilitychange', resumeStatus);
  window.addEventListener('online', resumeStatus);
  window.addEventListener('offline', pauseStatus);
  statusWatchdog = setInterval(() => {
    if (!eveSource.value || Date.now() - lastStatusAt > 10000) {
      if (Date.now() - lastStatusAt > 10000) uptimeSeconds.value = null;
      recoverStatus();
    }
  }, 5000);
  const available = await fetchData();
  if (!available || !pageActive) return;
  if (cpuUsageChart.value) initCpuUsageChart();
  initMemoryBall();
  optStart()
});
onUnmounted(() => {
    stopStatus();
    window.removeEventListener('resize', resizeCPU);
    cpuChartInstance?.dispose();
    cpuChartInstance = null;
    if (memoryBallAnimationId) cancelAnimationFrame(memoryBallAnimationId);
})
const productImage = computed(() => getProductImage(data.value?.device_info?.product_model));
</script>
<style lang="scss" >
 .home{
  background: #F2F4F5;
  .pdflex{
    display: flex;
    padding: 6px 10px;
  }
  .betflex{
    display: flex;
    justify-content: space-between;
  }

  .home-top-box{
    margin-bottom:20px ;
    display: flex;
    justify-content: space-between;
    height: 120px;
    background: #FFFFFF;
    border-radius: 12px;
    padding: 10px;
  }
  .home-top-box-productModel{
    font-weight: bold;
    font-size: 24px;
    color: rgba(0,0,0,0.9);
    text-transform: none;
  }
  .home-top-box-deviceId{
    font-weight: 400;
    font-size: 16px;
    color: rgba(0,0,0,0.6);
  }
  .home-top-box-left,.home-top-box-right{
    gap: 10px;
    display: flex;
    align-items: center;
    height: auto;
  }
  .home-top-box-time{
    font-weight: bold;
    font-size: 20px;
    color: #000000;
    margin:0px 10px 10px 0px;
  }
  .home-top-box-timeco{
    font-weight: 400;
    font-size: 14px;
    color: rgba(0,0,0,0.6);
    display: flex;
    justify-content: center;
  }
  .home-center-box{
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
  }
  .home-center-box-left{
    display: flex; justify-content: space-between;flex-direction: column;position: relative; overflow: hidden;
  }
  .memory-bg-container {
  position: absolute;
  width: 100%;
  height: 100%;
  z-index: 1;

  .memory-bg-image {
    width: 100%;
    height: 100%;
    // opacity: 0.8;
  }
  }
  .centerflex{
    display: flex;
    justify-content: center;
    gap: 30px;
  }

  .home-center-box-left,.home-center-box-right{
    width: 100%;
    height: auto;
    padding:10px;
    border-radius: 12px;
    background: #FFFFFF;
    font-weight: 500;
    font-size: 18px;
    color: rgba(0,0,0,0.9);
  }
  .home-center-box-center{
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .home-center-box-center-top,.home-center-box-center-bottom{
    height: 50%;
    padding:10px;
    border-radius: 12px;
    background: #FFFFFF;
  }
  .home-center-box-right-top,.home-center-box-right-bottom {
    height: 50%;
  }
  .home-center-box-center-top-title{
    width: 50%;
    font-weight: 500;
    font-size: 18px;
    color: rgba(0,0,0,0.9);
    margin-bottom: 10px;
  }

  .home-center-box-left-t{
    font-weight: 500;
    font-size: 20px;
    color: #000000;
    display: flex;
    justify-content: center;
  }
  .home-center-box-left-b{
    font-weight: 400;
    font-size: 14px;
    color: rgba(0,0,0,0.6);
    line-height: 22px;
  }
  .mar{
    margin-bottom:30px ;
    margin-left:16px ;
  }
  .home-center-box-center-top-statu{
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 400;
    font-size: 14px;
    color: rgba(0,0,0,0.6);
  }
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }

  .status-dot.connected {
    background-color: #67C23A;
  }

  .status-dot.disconnected {
    background-color: #F56C6C;
  }
  .connected-font{
    color: #67C23A;
  }
  .disconnected-font{
    color: #F56C6C;
  }
  .home-bottom-box{
    display: flex;
    gap: 10px;

  }
  .home-bottom-box-left{
    width: 33%;
    background: #FFFFFF;
    padding: 10px;
    border-radius: 12px;
  }
  .home-bottom-box-right{
    width: 66%;
    background: #FFFFFF;
    padding: 10px;
    border-radius: 12px;
  }
  .home-bottom-box-left-title{
    background: rgba(0,124,247,0.05);
    border-radius: 6px 6px 6px 6px;
    font-weight: 500;
    font-size: 18px;
    color: rgba(0,0,0,0.9);
    padding: 10px;
  }
  .formclass{
    display: flex;
    justify-content: space-between;
    border-bottom:1px solid #eee ;
    padding: 10px;
  }
  .formclass-left{
    font-weight: 400;
    font-size: 14px;
    color: #000000;
  }
  .formclass-right{
    font-weight: 500;
    font-size: 14px;
    color: #000000;
  }
  .wdj {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  position: relative;
  .circle-bg {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    position: absolute;
    z-index: 1;
    bottom: 30%;
  }
  }
  .temperature-icon {
    position: relative;
    z-index: 2;
    bottom: 10%;
  }
  .temperature-value {
      font-weight: bold;
      font-size: 24px;
      color: rgba(0, 0, 0, 0.9);
  }
  .wdjmar{
    margin-left:110px;
    margin-top: 30px;
  }
  .temperature-unit {
      font-weight: 400;
      font-size: 14px;
      color: rgba(0, 0, 0, 0.6);
      margin-left: 2px;
  }
  .storage-info {
    margin-top: 16px;
  }
  .combined-storage-bar {
    margin-bottom: 16px;
  }

  .storage-bar {
    width: 100%;
    height: 24px;
    background-color: #f0f0f0;
    border-radius: 12px;
    overflow: hidden;
    display: flex;
  }

  .system-segment {
    background-color: rgba(0, 199, 199, 1);
  }

  .used-segment {
    background-color: rgba(0, 124, 247, 1);
  }

  .available-segment {
    background-color: #eee;
  }

  .storage-legend {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .legend-item {
      display: flex;
      align-items: center;
      margin: 5px 0;
      font-size: 12px;
  }

  .legend-color {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 8px;
  }

  .system-color {
    background-color: rgba(0, 199, 199, 1);
  }

  .used-color {
    background-color: rgba(0, 124, 247, 1);
  }

  .available-color {
    background-color: #eee;
  }

  .legend-text {
  font-weight: 400;
  font-size: 14px;
  color: rgba(0,0,0,0.6);
  }

  .legend-value {
    font-weight: 500;
    font-size: 20px;
    color: #000000;
    margin-left:6px ;
  }
  .hrr{
    width: 100%;
    border: 1px solid #eee;
    margin:8px 0px ;
  }
  .memory-image-container {
  position: relative;
  width: 180px;
  height: 180px;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 222;
  margin-left:16px ;
  .memory-rate {
    position: absolute;
    display: flex;
    align-items: baseline;
  }
  .memory-number{
    font-size: 36px;
    font-weight: bold;
    color: #FFFFFF;
  }
  .memory-percent {
    font-size: 28px;
    font-weight: 500;
    color: #FFFFFF;
  }
  }
  .memory-status {
  position: absolute;
  bottom: 44px;
  font-size: 16px;
  font-weight: 500;
  color: #FFFFFF;
  }
  .home-bottom-box-right-one{
    background: #F5F7F9;
    border-radius: 8px;
    padding: 10px;
    position: relative;
    width: 100%;
    min-height: 280px;
  }
  .network-image-container {
    position: absolute;
    right: 6px;
    bottom: 6px;
  }
  .home-bottom-box-right-one-left{
    font-weight: 400;
    font-size: 14px;
    color: #000000;
    width: 80px;
  }
  .home-bottom-box-right-one-right{
    font-weight: 500;
    font-size: 14px;
    margin-left:24px ;
  }
  .network-container {
    position: relative;
    width: 100%;
    padding: 0px 32px;
    background: #FFFFFF;
    border-radius: 12px;
  }
  .network-nav {
  position: absolute;
  top: 50%;
  left: -10px;
  right: -10px;
  display: flex;
  justify-content: space-between;
  transform: translateY(-50%);
  z-index: 10;
  padding: 0 6px;

  .nav-button {
    width: 32px;
    height: 32px;
    border: none;
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      border-color: #ebeef5;
      color: #c0c4cc;
    }
    .el-icon {
      font-size: 24px;
      color: #666;
    }
  }
  }

  .network-item-wrapper {
  display: flex;
  gap: 10px;
  overflow: hidden;
    .network-item {
    flex: 1;
    min-width: calc(50% - 5px);
    transition: transform 0.3s ease;

    &.single-item {
      min-width: 100%;
    }
  }
  }
  .el-dialog__footer{
    width: 100%;
    padding: 10px;
    border-top:1px solid #eee ;
  }
  .el-dialog__title{
    font-weight: 400;
    font-size: 16px;
    color: #1D2129;
  }
  .no-data-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;

  .no-data-image {
    width: 100px;
    height: 80px;
  }

  .no-data-text {
    font-size: 14px;
    color: rgba(0, 0, 0, 0.45);
  }
  }
  .el-dialog__header{
    border-bottom: 1px solid #eee;
    padding: 10px 0px;
  }
 }

@media (max-width: 767px) {
  .home {
    .home-top-box {
      height: auto;
      flex-direction: column;
      gap: 12px;
      padding: 14px;
      margin-bottom: 12px;
    }
    .home-top-box-left > div { min-width: 0; overflow-wrap: anywhere; }
    .home-top-box-right { justify-content: space-between; padding-top: 10px; border-top: 1px solid #edf1f5; }
    .home-top-box-timeco { justify-content: flex-start; }
    .home-top-box-time { margin: 0; }
    .home-center-box, .home-bottom-box { flex-direction: column; margin-bottom: 12px; }
    .home-bottom-box-left, .home-bottom-box-right { width: 100%; }
    .home-center-box-center-top, .home-center-box-center-bottom,
    .home-center-box-right-top, .home-center-box-right-bottom { height: auto; }
    .home-center-box-left, .home-center-box-right, .home-center-box-center-top, .home-center-box-center-bottom { padding: 14px; }
    .home-center-box-left .mar { margin: 0; }
    .memory-image-container { margin-left: 0; }
    .wdj { height: 140px; }
    .home-center-box-center-top-title { width: auto; }
    .formclass { gap: 12px; }
    .formclass-left, .home-bottom-box-right-one-left { flex-shrink: 0; }
    .formclass-right, .home-bottom-box-right-one-right { min-width: 0; text-align: end; overflow-wrap: anywhere; }
    .network-container { padding: 0; }
    .network-nav { position: static; transform: none; justify-content: flex-end; padding: 0; margin-bottom: 8px; }
    .network-item-wrapper { flex-direction: column; }
    .home-bottom-box-right-one { min-height: 0; }
    .network-image-container { display: none; }
    .pdflex { justify-content: space-between; gap: 8px; padding-inline: 2px; }
    .home-bottom-box-right-one-right { margin-left: 0; }
  }
  #app .vl-main .home .home-top-box-productModel { font-size: 19px; }
  #app .vl-main .home .home-top-box-deviceId { font-size: 13px; }
  #app .vl-main .home-top-box-left .device-photo { width: 76px; height: 55px; }
}

</style>
