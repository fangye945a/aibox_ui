import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * 分段式容量条
 * 原版用三个绝对宽度 div 拼出来，这里改为 flex-basis 百分比，
 * 数据为 0 的段自动收缩，避免出现 1px 的视觉残渣。
 */
export interface Segment {
  value: number
  total: number
  color: string
  label: string
}

export function StorageBar({
  segments,
  height = 10,
  className,
}: {
  segments: Segment[]
  height?: number
  className?: string
}) {
  return (
    <div
      className={cn('flex w-full overflow-hidden rounded-full bg-black/[0.06]', className)}
      style={{ height }}
    >
      {segments.map((s) => {
        const pct = s.total > 0 ? Math.max(0, Math.min(100, (s.value / s.total) * 100)) : 0
        if (pct <= 0) return null
        return (
          <div
            key={s.label}
            className="h-full transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%`, backgroundColor: s.color }}
            title={`${s.label}：${s.value} GB（${pct.toFixed(1)}%）`}
          />
        )
      })}
    </div>
  )
}

/** 图例项 */
export function LegendItem({
  color,
  label,
  value,
  unit = 'GB',
}: {
  color: string
  label: string
  value: number | string
  unit?: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs text-black/60">{label}</span>
      <span className="tabular text-xs font-medium text-black/90">
        {value}
        <span className="ml-0.5 font-normal text-black/60">{unit}</span>
      </span>
    </div>
  )
}

/** 无数据占位 */
export function EmptyBlock({
  text = '暂无数据',
  image,
  action,
}: {
  text?: string
  image?: string
  action?: ReactNode
}) {
  return (
    <div className="flex h-full min-h-[96px] flex-col items-center justify-center gap-2 py-4">
      {image ? (
        <img src={image} alt="" className="h-16 w-auto opacity-70" />
      ) : (
        <div className="h-10 w-16 rounded bg-black/[0.04]" />
      )}
      <p className="text-xs text-black/60">{text}</p>
      {action}
    </div>
  )
}

/** 指标卡：数值 + 单位 + 标签，首页/监控共用 */
export function MetricStat({
  label,
  value,
  unit,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  unit?: string
  tone?: 'neutral' | 'brand' | 'danger'
}) {
  return (
    <div>
      <p className="flex items-baseline gap-0.5">
        <span
          className={cn(
            'tabular text-[19px] leading-none font-semibold',
            tone === 'danger' && 'text-[#f56c6c]',
            tone === 'brand' && 'text-[#007cf7]',
            tone === 'neutral' && 'text-black/90',
          )}
        >
          {value}
        </span>
        {unit && <span className="text-[11px] text-black/60">{unit}</span>}
      </p>
      <p className="mt-1 text-[11.5px] text-black/60">{label}</p>
    </div>
  )
}
