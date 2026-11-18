import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * 页面容器组件 — 还原原工程各页面 .xxx-box 的结构与尺寸
 *
 * 原工程约定（从 home.vue / log.vue / sysupdate.vue / password.vue 提取）：
 *   页面卡片     background #fff; border-radius 12px; padding 10px
 *   卡片标题     18px / 500 / rgba(0,0,0,.9)
 *   提示条       #F0F6FE 底 / 6px 圆角 / 14px 字
 *   内容区间距   margin-bottom 20px
 */

/** 卡片容器：等价原 .xxx-box */
export function Panel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-[12px] bg-white p-2.5', className)}
      {...props}
    >
      {children}
    </div>
  )
}

/** 卡片标题：等价原 .sysup-box-title / .log-box-left-title / 等 */
export function PanelTitle({
  children,
  extra,
  className,
}: {
  children: React.ReactNode
  extra?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-2.5 flex items-center justify-between', className)}>
      <p className="text-[18px] leading-snug font-medium text-black/90">{children}</p>
      {extra && <div className="flex items-center gap-2">{extra}</div>}
    </div>
  )
}

/** 提示条：等价原 .sysup-top / .note / .log-top */
export function Notice({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-[6px] bg-[#f0f6fe] px-3 py-1.5',
        'text-[14px] leading-normal text-black/90',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** 状态徽标：小圆点 + 文字，等价原 .status-dot + 状态文字 */
export function StatusDot({
  ok,
  text,
  className,
}: {
  ok: boolean
  text: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-[14px] font-normal',
        ok ? 'text-[#67c23a]' : 'text-[#f56c6c]',
        className,
      )}
    >
      <span
        className="inline-block size-2 rounded-full"
        style={{ backgroundColor: ok ? '#67c23a' : '#f56c6c' }}
      />
      {text}
    </span>
  )
}

/** 页面标题：等价原各页面的 <p class="xxx-title"> 但尺寸更大 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-2.5 flex items-start justify-between gap-4', className)}>
      <div className='min-w-0'>
        <p className='text-[18px] font-medium text-black/90'>{title}</p>
        {description && (
          <p className='mt-1 text-[13px] leading-relaxed text-black/60'>{description}</p>
        )}
      </div>
      {actions && <div className='flex shrink-0 items-center gap-2'>{actions}</div>}
    </div>
  )
}
