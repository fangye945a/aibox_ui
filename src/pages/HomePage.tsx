import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { getInfo, restart } from '@/api/home'
import type { SystemInfo, RunningStatusEvent } from '@/types/api'
import { useSseJson } from '@/hooks/useDeviceSse'
import { useUptime } from '@/hooks/useCommon'
import {
  DEVICE_ID_CACHE_KEY,
  formatUptime,
} from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MemoryBall } from '@/components/MemoryBall'
import { LegendItem } from '@/components/StorageBar'
import { useEChart } from '@/hooks/useEChart'
import nodataImg from '@/assets/img/nodata.png'

/**
 * 存储条配色
 * 用「深 → 浅 → 近底」的单一色相递进表达占用关系，
 * 比原来的青 + 蓝 + 灰三色拼盘更克制，读起来也更像一条刻度尺。
 */
/** 存储条配色，还原原 home.vue：系统占用青色、已用主蓝、可用浅灰 */
const COLOR = {
  system: 'rgba(0,199,199,1)',
  used: 'rgba(0,124,247,1)',
  free: '#eeeeee',
} as const

const ITEMS_PER_PAGE = 2

/**
 * 首页 · 运行总览
 *
 * 功能与迁移前 home.vue 完全一致：
 *   - /api/system/info 取快照，SSE runningStatus 通道增量刷新；
 *   - 累计运行时间本地每秒自增；
 *   - 内存液面球 high ≥ 80% 转告警配色；
 *   - CPU 使用率仪表（ECharts gauge）+ CPU 温度阈值 70℃；
 *   - 存储 / 扩展存储分段条；
 *   - 网络信息分页展示（每页 2 个）；
 *   - 重启二次确认。
 */
export default function HomePage() {
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [restartOpen, setRestartOpen] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [netIndex, setNetIndex] = useState(0)

  const { data: live } = useSseJson<RunningStatusEvent>(true, 'runningStatus')

  const fetchInfo = useCallback(async () => {
    try {
      const res = await getInfo()
      setInfo(res.data)
      const id = res.data?.device_info?.device_id
      if (id) localStorage.setItem(DEVICE_ID_CACHE_KEY, id)
    } catch {
      /* 请求层已提示 */
    }
  }, [])

  useEffect(() => {
    void fetchInfo()
  }, [fetchInfo])

  const uptime = useUptime(info?.boot_time)

  // ── 派生数据：SSE 优先，回落到快照 ──
  const memoryRate = Number(live?.memory_used ?? info?.memory_info?.rate ?? 0)
  const memoryUsed = Number(live?.memory ?? info?.memory_info?.memory_used ?? 0)
  const memoryTotal = Number(info?.memory_info?.memory ?? 0)
  const cpuUsage = Number(live?.cpu_usage ?? info?.cpu_usage ?? 0)
  const cpuTemp = Number(live?.cpu_temperature ?? info?.cpu_temperature ?? 0)

  const memDanger = memoryRate >= 80
  const cpuDanger = cpuUsage >= 60
  const tempDanger = cpuTemp >= 70

  // ── 存储 ──
  const storage = info?.storage_info ?? null
  const expansion = info?.storage_expansion_info ?? null

  const storageSegments = useMemo(() => {
    if (!storage) return []
    const total = Number(storage.storage) || 0
    return [
      {
        label: '系统占用',
        value: Number(storage.storage_system_used) || 0,
        total,
        color: COLOR.system,
      },
      {
        label: '已用存储',
        value: Number(storage.storage_used) || 0,
        total,
        color: COLOR.used,
      },
      {
        label: '剩余可用',
        value: Number(storage.storage_can_used) || 0,
        total,
        color: COLOR.free,
      },
    ]
  }, [storage])

  const expansionSegments = useMemo(() => {
    if (!expansion) return []
    const total = Number(expansion.storage_expansion) || 0
    return [
      {
        label: '已用存储',
        value: Number(expansion.storage_expansion_used) || 0,
        total,
        color: COLOR.used,
      },
      {
        label: '剩余可用',
        value: Number(expansion.storage_expansion_can_used) || 0,
        total,
        color: COLOR.free,
      },
    ]
  }, [expansion])

  /** 存储数值（对应原 home.vue 的 storageInfo） */
  const storageInfo = useMemo(
    () => ({
      systemUsed: Number(storage?.storage_system_used) || 0,
      used: Number(storage?.storage_used) || 0,
      available: Number(storage?.storage_can_used) || 0,
      total: Number(storage?.storage) || 0,
    }),
    [storage],
  )

  /** 扩展存储数值（对应原 expansionStorageInfo） */
  const expansionInfo = useMemo(
    () => ({
      used: Number(expansion?.storage_expansion_used) || 0,
      available: Number(expansion?.storage_expansion_can_used) || 0,
      total: Number(expansion?.storage_expansion) || 0,
    }),
    [expansion],
  )

  /**
   * CPU 使用率仪表盘
   *
   * 还原原 home.vue 的 gauge 视觉（180°→0°、半圆、指针、圆头进度条），
   * 但改为**按容器实际尺寸计算半径**：
   *
   * 原实现用 radius:'100%' + detail offsetCenter -120%。
   * 百分比半径在宽扁容器里取的是 min(w,h)/2，而 detail 的偏移按半径算，
   * 一旦容器变矮，数值就会被推出画布上沿裁掉 —— 这就是"数值被遮挡"的根因。
   *
   * 这里显式算出像素半径 R = min(w/2, h) * 0.84，
   * 并把指针、数值都约束在 R 之内，任何容器比例下都不会越界。
   */
  const [gaugeBox, setGaugeBox] = useState({ w: 0, h: 0 })
  const cpuBoxRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = cpuBoxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setGaugeBox({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    setGaugeBox({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const cpuOption = useMemo(() => {
    const w = gaugeBox.w || 400
    const h = gaugeBox.h || 100
    // 半圆仪表垂直方向需要的高度约为 1.15R（含弧线粗度与数值）
    // 半径同时受宽度和高度约束，取两者能容下的最大值
    const R = Math.max(20, Math.min(w / 2 - 14, (h - 10) / 1.15))
    const lineW = Math.max(8, Math.min(14, R * 0.22))

    return {
      animation: false,
      series: [
        {
          type: 'gauge' as const,
          startAngle: 180,
          endAngle: 0,
          min: 0,
          max: 100,
          radius: R,
          // centerY 下移一点，让半圆自身的顶部就留出数值空间
          center: ['50%', '78%'],
          pointer: {
            show: true,
            length: `${(R * 0.5).toFixed(1)}px`,
            width: 5,
            offsetCenter: [0, 0],
            itemStyle: {
              color: {
                type: 'linear' as const,
                x: 0,
                y: 0,
                x2: 1,
                y2: 0,
                colorStops: [
                  { offset: 0, color: '#4a90e2' },
                  { offset: 1, color: '#1565c0' },
                ],
              },
            },
          },
          anchor: {
            show: true,
            size: 6,
            showAbove: true,
            itemStyle: { color: '#ffffff', borderWidth: 2, borderColor: '#4a90e2' },
          },
          progress: {
            show: true,
            roundCap: true,
            width: lineW,
            itemStyle: { color: cpuUsage >= 70 ? '#f56c6c' : '#409eff' },
          },
          axisLine: {
            roundCap: true,
            lineStyle: { width: lineW, color: [[1, '#eeeeee']] },
          },
          axisTick: { show: false },
          splitLine: {
            show: true,
            length: Math.max(4, R * 0.1),
            distance: -lineW,
            lineStyle: { color: '#ffffff', width: 1 },
          },
          axisLabel: { show: false },
          // 数值放在仪表内腔（圆心上方 40% 半径处），因为圆心在 78% 高度、
          // 半径只占容器约 40%，这个位置离画布上下边缘都有充足余量
          detail: {
            valueAnimation: false,
            fontSize: Math.max(13, Math.min(20, R * 0.34)),
            fontWeight: 'bold',
            color: 'black',
            formatter: '{value}%',
            offsetCenter: [0, '-42%'],
          },
          data: [{ value: Math.round(cpuUsage) || 0 }],
        },
      ],
    }
  }, [cpuUsage, gaugeBox.w, gaugeBox.h])

  const { containerRef: cpuChartRef } = useEChart(cpuOption, [cpuOption])

  // 同时把测量 ref 挂到同一个节点
  const setCpuBox = useCallback(
    (node: HTMLDivElement | null) => {
      cpuChartRef.current = node
      ;(cpuBoxRef as React.MutableRefObject<HTMLDivElement | null>).current = node
    },
    [cpuChartRef],
  )

  // ── 网络分页 ──
  const networks = info?.network_info ?? []
  const visibleNetworks = networks.slice(netIndex, netIndex + ITEMS_PER_PAGE)

  async function handleRestart() {
    setRestarting(true)
    try {
      const res = await restart()
      toast.success(res.msg || '重启指令已下发')
      setRestartOpen(false)
    } catch {
      /* 请求层已提示 */
    } finally {
      setRestarting(false)
    }
  }

  const deviceInfo = info?.device_info

  return (
    <div>
      {/* ══ 顶部：设备型号 + 运行时长 + 重启 ══ */}
      <div className="mb-5 flex h-[120px] items-center justify-between rounded-[12px] bg-white p-2.5">
        <div className="flex items-center gap-2.5">
          <img
            src={new URL('@/assets/img/ct21b.png', import.meta.url).href}
            alt=""
            className="h-[100px] w-auto object-contain"
          />
          {deviceInfo && (
            <div>
              <p className="text-[24px] leading-normal font-bold text-black/90">
                在鸿工控机-{deviceInfo.product_model}
              </p>
              <p className="text-[16px] leading-normal font-normal text-black/60">
                设备编号：{deviceInfo.device_id}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {info && (
            <div className="mr-2.5 mb-2.5 text-right">
              <p className="tabular text-[20px] leading-normal font-bold text-black">
                {formatUptime(uptime)}
              </p>
              <p className="flex justify-center text-[14px] leading-normal font-normal text-black/60">
                累计运行时间
              </p>
            </div>
          )}
          <Button variant="primary" onClick={() => setRestartOpen(true)}>
            重启
          </Button>
        </div>
      </div>

      {/* ══ 中部：内存 / CPU / 存储 三列 ══ */}
      <div className="mb-5 flex gap-2.5">
        {/* 内存 */}
        <div className="relative w-full overflow-hidden rounded-[12px] bg-white p-2.5">
          <p className="text-[18px] leading-normal font-medium text-black/90">系统内存</p>

          <div className="flex justify-center py-1">
            <div className="relative z-10 ml-4 flex size-[180px] items-center justify-center">
              <MemoryBall value={memoryRate} danger={memDanger} size={180} />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="flex items-baseline text-white">
                  <span className="tabular text-[36px] leading-none font-bold">
                    {Number.isFinite(memoryRate) ? Math.round(memoryRate) : 0}
                  </span>
                  <span className="text-[28px] font-medium">%</span>
                </p>
                <p className="mt-1 text-[16px] font-medium text-white">
                  {memDanger ? '异常' : '正常'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-[30px]">
            <div className="mb-[30px] ml-4">
              <p className="flex justify-center text-[20px] leading-normal font-medium text-black">
                {memoryUsed}GB
              </p>
              <p className="text-[14px] leading-[22px] font-normal text-black/60">已用内存</p>
            </div>
            <div className="mb-[30px] ml-4">
              <p className="flex justify-center text-[20px] leading-normal font-medium text-black">
                {memoryTotal}GB
              </p>
              <p className="text-[14px] leading-[22px] font-normal text-black/60">本机内存</p>
            </div>
          </div>
        </div>

        {/* CPU 使用率 + 温度 */}
        <div className="flex w-full flex-col gap-2.5">
          <div className="flex min-h-[186px] flex-1 flex-col overflow-hidden rounded-[12px] bg-white p-2.5">
            <div className="flex shrink-0 items-start justify-between">
              <p className="text-[18px] leading-normal font-medium text-black/90">
                CPU使用率
              </p>
              {info && (
                <p className="flex items-center gap-1.5 pt-1 text-[14px] leading-none font-normal text-black/60">
                  <span
                    className="dot"
                    style={{ backgroundColor: cpuDanger ? '#f56c6c' : '#67c23a' }}
                  />
                  {cpuDanger ? '异常' : '正常'}
                </p>
              )}
            </div>
            <div ref={setCpuBox} className="min-h-0 w-full flex-1" />
          </div>

          {/*
            CPU 温度
            布局：标题左上 / 状态右上 / 图标与数值居中
            （原来是"左文字 + 右图标"横排，状态挤在标题同一行，视觉重心偏左）
          */}
          <div className="relative flex min-h-[140px] flex-1 flex-col rounded-[12px] bg-white p-2.5">
            {/*
              标题与状态绝对定位在卡片顶部两角，
              不占据文档流 —— 这样下方图标区可以按整张卡片的高度垂直居中，
              否则会相对"标题以下剩余空间"居中，视觉上整体下偏。
            */}
            <div className="pointer-events-none absolute inset-x-2.5 top-2.5 flex items-start justify-between">
              <p className="text-[18px] leading-normal font-medium text-black/90">
                CPU温度
              </p>
              {info && (
                <p className="flex items-center gap-1.5 pt-1 text-[14px] leading-none font-normal text-black/60">
                  <span
                    className="dot"
                    style={{ backgroundColor: tempDanger ? '#f56c6c' : '#67c23a' }}
                  />
                  {tempDanger ? '异常' : '正常'}
                </p>
              )}
            </div>

            {/*
              图标严格居中（水平中心 = 卡片中心），数值置于图标右侧。
              数值用绝对定位并限制在卡片内，避免影响图标的居中基准。
            */}
            <div className="relative flex min-h-0 flex-1 items-center justify-center">
              <img
                src={
                  tempDanger
                    ? new URL('@/assets/img/wdjf.png', import.meta.url).href
                    : new URL('@/assets/img/wdjt.png', import.meta.url).href
                }
                alt=""
                className="h-[64px] w-auto object-contain"
              />
              {/* 数值：以图标中心为原点向右偏移 44px（图标半宽 27 + 间距 17） */}
              <div className="absolute top-1/2 left-1/2 flex translate-x-[44px] -translate-y-1/2 items-baseline">
                <span
                  className="tabular text-[26px] leading-none font-bold"
                  style={{ color: tempDanger ? '#f56c6c' : '#000000' }}
                >
                  {Number.isFinite(cpuTemp) ? Math.round(cpuTemp) : '—'}
                </span>
                <span className="ml-0.5 text-[14px] font-normal text-black/60">℃</span>
              </div>
            </div>
          </div>
        </div>

        {/* 存储 + 扩展存储 */}
        <div className="flex w-full flex-col rounded-[12px] bg-white p-2.5">
          <div className="flex-1">
            <p className="mb-2.5 text-[18px] leading-normal font-medium text-black/90">存储</p>
            {storage ? (
              <div className="mt-4">
                <div className="mb-4 flex h-6 w-full overflow-hidden rounded-[12px] bg-[#f0f0f0]">
                  {storageSegments.map((seg, i) => {
                    const pct =
                      seg.total > 0 ? Math.max(0, Math.min(100, (seg.value / seg.total) * 100)) : 0
                    if (pct <= 0) return null
                    return (
                      <div
                        key={i}
                        className="h-full"
                        style={{ width: `${pct}%`, backgroundColor: seg.color }}
                        title={`${seg.label}: ${seg.value}GB`}
                      />
                    )
                  })}
                </div>
                <div className="flex flex-wrap justify-between">
                  <LegendItem color={COLOR.system} label="系统占用" value={storageInfo.systemUsed} />
                  <LegendItem color={COLOR.used} label="已用存储" value={storageInfo.used} />
                  <LegendItem color={COLOR.free} label="剩余可用" value={storageInfo.available} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <img src={nodataImg} alt="" className="h-20 w-[100px] object-contain" />
                <p className="text-[14px] text-black/45">暂无数据</p>
              </div>
            )}
          </div>

          <p className="my-2 w-full shrink-0 border-t border-[#eee]" />

          <div className="flex-1">
            <p className="mb-2.5 text-[18px] leading-normal font-medium text-black/90">
              扩展存储
            </p>
            {expansion ? (
              <div className="mt-4">
                <div className="mb-4 flex h-6 w-full overflow-hidden rounded-[12px] bg-[#f0f0f0]">
                  {expansionSegments.map((seg, i) => {
                    const pct =
                      seg.total > 0 ? Math.max(0, Math.min(100, (seg.value / seg.total) * 100)) : 0
                    if (pct <= 0) return null
                    return (
                      <div
                        key={i}
                        className="h-full"
                        style={{ width: `${pct}%`, backgroundColor: seg.color }}
                        title={`${seg.label}: ${seg.value}GB`}
                      />
                    )
                  })}
                </div>
                <div className="flex flex-wrap justify-between">
                  <LegendItem color={COLOR.used} label="已用存储" value={expansionInfo.used} />
                  <LegendItem color={COLOR.free} label="剩余可用" value={expansionInfo.available} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <img src={nodataImg} alt="" className="h-20 w-[100px] object-contain" />
                <p className="text-[14px] text-black/45">暂无数据</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ 底部：设备信息 + 网络 ══ */}
      <div className="flex gap-2.5">
        {/* 设备基本信息：占 33% */}
        <div className="w-1/3 rounded-[12px] bg-white p-2.5">
          <p className="rounded-[6px] bg-[rgba(0,124,247,0.05)] p-2.5 text-[18px] leading-normal font-medium text-black/90">
            设备基本信息
          </p>
          <InfoRow k="产品型号" v={deviceInfo?.product_model} />
          <InfoRow k="设备编号" v={deviceInfo?.device_id} />
          <InfoRow k="系统版本" v={deviceInfo?.system_version} />
          <InfoRow k="运行内存" v={deviceInfo?.memory_type} />
          <InfoRow k="存储大小" v={deviceInfo?.storage} suffix="GB" />
          <InfoRow k="扩展存储" v={deviceInfo?.storage_expansion} suffix="GB" />
          <InfoRow k="NPU算力" v={deviceInfo?.compute_power} suffix="TOPS" />
        </div>

        {/* 网络：占 66% */}
        <div className="w-2/3 rounded-[12px] bg-white p-2.5">
          <div className="relative w-full bg-white px-8">
            {networks.length > ITEMS_PER_PAGE && (
              <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-1.5">
                <button
                  disabled={netIndex === 0}
                  onClick={() => setNetIndex((i) => Math.max(0, i - ITEMS_PER_PAGE))}
                  className="grid size-8 place-items-center rounded-[2px] text-[#666] disabled:opacity-50"
                  aria-label="上一组"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  disabled={netIndex + ITEMS_PER_PAGE >= networks.length}
                  onClick={() => setNetIndex((i) => i + ITEMS_PER_PAGE)}
                  className="grid size-8 place-items-center rounded-[2px] text-[#666] disabled:opacity-50"
                  aria-label="下一组"
                >
                  <ChevronRight className="size-6" />
                </button>
              </div>
            )}

            <div className="flex gap-2.5 overflow-hidden">
              {visibleNetworks.map((net, i) => (
                <div
                  key={`${net.interface}-${i}`}
                  className={visibleNetworks.length === 1 ? 'min-w-full flex-1' : 'min-w-[calc(50%-5px)] flex-1'}
                >
                  <p className="mb-2.5 text-[18px] leading-normal font-medium text-black/90">
                    {net.type === 'wifi' ? 'WiFi' : '以太网'}
                  </p>
                  <div className="relative min-h-[280px] w-full rounded-[8px] bg-[#f5f7f9] p-2.5">
                    <NetRow
                      k="连接状态"
                      v={net.status === 1 ? '已连接' : '未连接'}
                      color={net.status === 1 ? '#67c23a' : '#f56c6c'}
                    />
                    <NetRow k="以太网接口" v={net.interface} />
                    <NetRow k="IP地址" v={net.IP} />
                    <NetRow k="网关" v={net.gateway} />
                    <NetRow k="子网掩码" v={net.subnet_mask} />
                    <NetRow k="DNS" v={net.DNS} />
                    <div className="absolute right-1.5 bottom-1.5">
                      <img
                        src={
                          net.type === 'wifi'
                            ? new URL('@/assets/img/wangluof.png', import.meta.url).href
                            : new URL('@/assets/img/wangluo.png', import.meta.url).href
                        }
                        alt=""
                        className="h-12 w-auto object-contain"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══ 重启确认 ══ */}
      <Dialog open={restartOpen} onOpenChange={setRestartOpen}>
        <DialogContent className="max-w-[480px] p-0">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-normal text-[#1d2129]">重启</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="py-2.5 text-[14px] font-normal text-black/90">
              确定要重启设备吗？重启过程中页面功能将无法使用。
            </p>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setRestartOpen(false)}>取消</Button>
            <Button variant="primary" disabled={restarting} onClick={handleRestart}>
              {restarting ? '下发中…' : '重启'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** 设备信息行：还原原 .formclass */
function InfoRow({ k, v, suffix }: { k: string; v?: string | number | null; suffix?: string }) {
  return (
    <div className="flex justify-between border-b border-[#eee] p-2.5">
      <p className="text-[14px] font-normal text-black">{k}</p>
      <p className="text-[14px] font-medium text-black">
        {v === undefined || v === null || v === '' ? '—' : v}
        {suffix && v !== undefined && v !== null && v !== '' && suffix}
      </p>
    </div>
  )
}

/** 网络信息行：还原原 .pdflex */
function NetRow({ k, v, color }: { k: string; v?: string | null; color?: string }) {
  return (
    <div className="flex px-2.5 py-1.5">
      <p className="w-20 text-[14px] font-normal text-black">{k}</p>
      <p
        className="ml-6 text-[14px] font-medium"
        style={{ color: color ?? '#000' }}
      >
        {v || '—'}
      </p>
    </div>
  )
}

/* ── 局部小件 ── */
