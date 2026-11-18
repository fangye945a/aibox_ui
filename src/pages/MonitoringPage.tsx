import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Search, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { getMonitoring } from '@/api/monitoring'
import type { MonitorIndicator, MonitorPoint } from '@/types/api'
import { useEChart } from '@/hooks/useEChart'
import { formatDateTime, cn } from '@/lib/utils'
import { Panel, PanelTitle, PageHeader } from '@/components/ui/layout-bits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface MetricDef {
  key: MonitorIndicator
  label: string
  unit: string
  color: string
  areaFrom: string
  max?: number
  interval?: number
}

/** 六个指标与原 monitoring.vue 一一对应 */
const METRICS: MetricDef[] = [
  {
    key: 'cpu_usage',
    label: 'CPU 使用率',
    unit: '%',
    color: '#5470c6',
    areaFrom: 'rgba(0,124,247,1)',
    max: 100,
    interval: 10,
  },
  {
    key: 'memory_used',
    label: '内存使用率',
    unit: '%',
    color: '#5470c6',
    areaFrom: 'rgba(0,124,247,1)',
    max: 100,
    interval: 10,
  },
  {
    key: 'uplink_network',
    label: '上行流量',
    unit: 'KB/s',
    color: 'rgba(5, 213, 180, 1)',
    areaFrom: 'rgba(5, 213, 180, 1)',
  },
  {
    key: 'downstream_network',
    label: '下行流量',
    unit: 'KB/s',
    color: 'rgba(5, 213, 180, 1)',
    areaFrom: 'rgba(5, 213, 180, 1)',
  },
  {
    key: 'disk_read_rate',
    label: '磁盘读速率',
    unit: 'KB/s',
    color: 'rgba(86, 86, 214, 1)',
    areaFrom: 'rgba(86, 86, 214, 1)',
  },
  {
    key: 'disk_write_rate',
    label: '磁盘写速率',
    unit: 'KB/s',
    color: 'rgba(86, 86, 214, 1)',
    areaFrom: 'rgba(86, 86, 214, 1)',
  },
]

/**
 * 监控运维
 * 交互与原版一致：切到某个指标 tab 才初始化并自动查询最近 2 小时数据。
 * 改善了原版三处体验问题：
 *   1. 时间选择由 el-date-picker 换成原生 datetime-local，少 30KB 且行为可控；
 *   2. 图表容器改用 ResizeObserver，侧栏折叠不再错位；
 *   3. 空数据时给出明确提示，而不是只弹 toast。
 */
export default function MonitoringPage() {
  const [active, setActive] = useState<MonitorIndicator>('cpu_usage')
  return (
    <div>
      <PageHeader
        title="监控运维"
        description="按时间区间检索设备性能指标，数据由设备本地采集，不支持跨区间聚合。"
      />
      <Panel className="p-4">
        <Tabs value={active} onValueChange={(v) => setActive(v as MonitorIndicator)}>
          <TabsList className="overflow-x-auto">
            {METRICS.map((m) => (
              <TabsTrigger key={m.key} value={m.key} className="shrink-0">
                {m.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {METRICS.map((m) => (
            <TabsContent key={m.key} value={m.key} className="mt-4">
              {/* 只渲染当前激活的图表，避免 6 个 ECharts 实例常驻占用设备内存 */}
              {active === m.key && <MetricChart metric={m} />}
            </TabsContent>
          ))}
        </Tabs>
      </Panel>
    </div>
  )
}

function MetricChart({ metric }: { metric: MetricDef }) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [points, setPoints] = useState<MonitorPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [queried, setQueried] = useState(false)

  const applyDefaultRange = useCallback(() => {
    const now = new Date()
    const twoHoursAgo = new Date(now.getTime() - 2 * 3600 * 1000)
    setStart(toLocalInput(twoHoursAgo))
    setEnd(toLocalInput(now))
  }, [])

  const query = useCallback(
    async (s: string, e: string) => {
      if (!s || !e) {
        toast.warning('请选择开始时间和结束时间')
        return
      }
      if (new Date(s) >= new Date(e)) {
        toast.warning('开始时间必须早于结束时间')
        return
      }
      setLoading(true)
      try {
        const res = await getMonitoring({
          type: metric.key,
          start_time: normalize(s),
          end_time: normalize(e),
        })
        const payload = res.data
        let list: MonitorPoint[] = []
        // 兼容两种后端返回形态
        if (Array.isArray(payload)) {
          list = payload.find((it) => it.type === metric.key)?.list ?? []
        } else if (payload && typeof payload === 'object') {
          const v = (payload as Record<string, MonitorPoint[]>)[metric.key]
          list = Array.isArray(v) ? v : []
        }
        setPoints(list)
        setQueried(true)
        if (list.length === 0) toast.info('所选时间范围内无数据')
      } catch {
        setPoints([])
        setQueried(true)
      } finally {
        setLoading(false)
      }
    },
    [metric.key],
  )

  // tab 激活即设置默认区间并查询（对齐原版 watch(active) 行为）
  useEffect(() => {
    const now = new Date()
    const twoHoursAgo = new Date(now.getTime() - 2 * 3600 * 1000)
    const s = toLocalInput(twoHoursAgo)
    const e = toLocalInput(now)
    setStart(s)
    setEnd(e)
    void query(s, e)
  }, [query])

  const option = useMemo(() => {
    return {
      animationDuration: 400,
      grid: { left: 8, right: 16, top: 28, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(48,49,51,0.95)',
        borderWidth: 0,
        padding: [7, 10],
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: (params: unknown) => {
          const arr = params as Array<{ name: string; value: number }>
          const p = arr?.[0]
          if (!p) return ''
          return `${p.name}<br/>${metric.label}：<b>${p.value}</b> ${metric.unit}`
        },
      },
      xAxis: {
        type: 'category' as const,
        boundaryGap: false,
        data: points.map((p) => p.time),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: 'rgba(0,0,0,0.12)' } },
        axisLabel: { color: '#909399', fontSize: 11, hideOverlap: true },
      },
      yAxis: {
        type: 'value' as const,
        min: 0,
        max: metric.max ?? null,
        interval: metric.interval ?? null,
        axisLabel: {
          color: '#909399',
          fontSize: 11,
          formatter: (v: number) => (metric.unit === '%' ? `${v}%` : String(v)),
        },
        splitLine: { lineStyle: { color: 'rgba(0,0,0,0.06)' } },
        name: metric.unit,
        nameTextStyle: { color: '#909399', fontSize: 11, padding: [0, 0, 6, 0] },
      },
      series: [
        {
          type: 'line' as const,
          smooth: true,
          symbol: 'circle',
          symbolSize: 5,
          showSymbol: points.length <= 60,
          data: points.map((p) => p.value),
          itemStyle: { color: metric.color },
          lineStyle: { width: 2, color: metric.color },
          areaStyle: {
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: metric.areaFrom.replace(/[\d.]+\)$/, '0.28)') },
                { offset: 1, color: metric.areaFrom.replace(/[\d.]+\)$/, '0.01)') },
              ],
            },
          },
        },
      ],
    }
  }, [points, metric])

  const { containerRef } = useEChart(option, [option])

  const isEmpty = queried && points.length === 0 && !loading

  return (
    <div>
      {/* 查询条件 */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-[8px] border border-[#eeeeee] bg-black/[0.015] px-4 py-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-black/60">开始时间</span>
          <Input
            type="datetime-local"
            step={1}
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-[200px]"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-black/60">结束时间</span>
          <Input
            type="datetime-local"
            step={1}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-[200px]"
          />
        </label>
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={() => query(start, end)} disabled={loading}>
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Search className="size-3.5" />
            )}
            查询
          </Button>
          <Button
            onClick={() => {
              applyDefaultRange()
              const now = new Date()
              const s = toLocalInput(new Date(now.getTime() - 2 * 3600 * 1000))
              const e = toLocalInput(now)
              void query(s, e)
            }}
          >
            <RotateCcw className="size-3.5" />
            重置
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-3 text-[11.5px] text-black/60">
          {queried && !loading && (
            <span className="tabular">共 {points.length} 个采样点</span>
          )}
        </div>
      </div>

      {/* 图表 */}
      <div className="relative">
        <PanelTitle className="mb-2">
          {metric.label}
          <span className="ml-2 text-[11.5px] font-normal text-black/60">
            单位 {metric.unit}
          </span>
        </PanelTitle>
        <div
          className={cn(
            'relative h-[520px] w-full rounded-[8px] border border-[#eeeeee] bg-white p-3',
            (loading || isEmpty) && 'animate-pulse',
          )}
        >
          <div ref={containerRef} className="size-full" />
          {isEmpty && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="text-[13px] text-black/60">该时间范围内无采集数据</p>
                <p className="mt-1 text-[11.5px] text-black/60">
                  请放宽时间区间，或确认设备采集服务是否正常运行
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Date -> datetime-local 需要的 YYYY-MM-DDTHH:mm:ss */
function toLocalInput(d: Date): string {
  return formatDateTime(d).replace(' ', 'T')
}

/** datetime-local 输出给后端时保留标准空格格式 */
function normalize(v: string): string {
  return v.replace('T', ' ')
}
