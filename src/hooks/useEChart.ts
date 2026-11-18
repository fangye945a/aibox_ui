import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { GaugeChart, LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  AxisPointerComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'

// 按需注册，产物比全量引入小约 600KB —— 设备端内存只有 512MB，这一点很关键
echarts.use([
  GaugeChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  AxisPointerComponent,
  CanvasRenderer,
])

/**
 * ECharts 挂载 hook
 * - 容器尺寸变化时自动 resize（原版只监听 window resize，侧边栏折叠时图表会错位）
 * - 卸载时 dispose，避免 Canvas 泄漏
 */
export function useEChart(
  option: EChartsCoreOption | null,
  deps: unknown[] = [],
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = echarts.init(el, undefined, { renderer: 'canvas' })
    chartRef.current = chart

    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!chartRef.current || !option) return
    // notMerge=true：指标切换时彻底替换，避免旧 series 残留
    chartRef.current.setOption(option, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { containerRef, chartRef }
}

export { echarts }
