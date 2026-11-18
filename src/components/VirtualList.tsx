import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * 轻量虚拟滚动列表
 *
 * 替代 vue-virtual-scroller 的 DynamicScroller。
 * 设备端会持续推送日志（上限 1 万行），DOM 节点必须复用，否则内存与渲染都会崩。
 *
 * 实现要点：
 *  - 固定行高，按 scrollTop 计算可视窗口，上下各留 buffer 行；
 *  - 行高固定是因为日志行统一用 11.5px/1.55 的等宽排版，
 *    比动态测量方案简单，且与原版 min-item-size=28 的量级一致。
 */
interface Props<T> {
  items: T[]
  /** 单行高度（px），必须与实际渲染高度一致 */
  itemHeight?: number
  /** 上下缓冲行数 */
  buffer?: number
  /** 视口高度，不传则自适应父容器 */
  height?: number | string
  renderItem: (item: T, index: number) => ReactNode
  /** 滚动容器 ref 暴露，供外部做「滚到底部」等操作 */
  scrollerRef?: React.MutableRefObject<HTMLDivElement | null>
  onUserScroll?: () => void
  className?: string
}

export function VirtualList<T>({
  items,
  itemHeight = 28,
  buffer = 12,
  height = '100%',
  renderItem,
  scrollerRef,
  onUserScroll,
  className,
}: Props<T>) {
  const innerRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewport, setViewport] = useState(600)

  // 容器尺寸观察
  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setViewport(el.clientHeight || 600))
    ro.observe(el)
    setViewport(el.clientHeight || 600)
    return () => ro.disconnect()
  }, [])

  const total = items.length
  const totalHeight = total * itemHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer)
  const visibleCount = Math.ceil(viewport / itemHeight) + buffer * 2
  const endIndex = Math.min(total, startIndex + visibleCount)
  const slice = items.slice(startIndex, endIndex)

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop)
      onUserScroll?.()
    },
    [onUserScroll],
  )

  return (
    <div
      ref={(node) => {
        innerRef.current = node
        if (scrollerRef) scrollerRef.current = node
      }}
      onScroll={handleScroll}
      style={{ height }}
      className={className}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${startIndex * itemHeight}px)`,
            willChange: 'transform',
          }}
        >
          {slice.map((item, i) => (
            <div key={startIndex + i} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
