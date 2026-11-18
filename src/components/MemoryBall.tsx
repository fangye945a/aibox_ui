import { useEffect, useRef } from 'react'

/**
 * 内存液面球
 *
 * 直接移植原 home.vue 内的 Canvas 实现（波浪 + 高光 + 边缘反光），
 * 保持视觉一致，仅做两点工程化处理：
 *  1. 设备像素比适配 —— 原版固定 180×180，高分屏下边缘发虚；
 *  2. 动画帧与组件生命周期绑定，卸载即取消，避免切页后后台空转。
 */

interface Props {
  /** 使用率 0-100 */
  value: number
  /** 高于阈值切换为告警配色 */
  danger?: boolean
  size?: number
}

export function MemoryBall({ value, danger = false, size = 168 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const valueRef = useRef(value)
  const dangerRef = useRef(danger)
  valueRef.current = value
  dangerRef.current = danger

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 高分屏适配：按 dpr 放大画布，CSS 尺寸保持不变
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2
    const radius = size / 2 - 6
    let raf = 0

    const draw = () => {
      const usage = Math.max(0, Math.min(100, valueRef.current || 0))
      const isHigh = dangerRef.current

      // 配色取自设计令牌：常态深松绿，告警砖红。
      // 用半透明分层叠出"液面玻璃"质感，而不是平涂一个圆。
      // 严格还原原 home.vue 的内存球配色：常态主蓝 #007CF7、告警 #F56C6C
      const borderColor = isHigh ? 'rgba(245,108,108,0.20)' : 'rgba(0,124,247,0.20)'
      const bgColor = isHigh ? 'rgba(245,108,108,0.30)' : 'rgba(0,124,247,0.30)'
      const gradStart = isHigh ? 'rgba(245,108,108,1)' : 'rgba(0,124,247,1)'
      const gradEnd = isHigh ? 'rgba(245,108,108,0.60)' : 'rgba(0,124,247,0.60)'
      const fillColor = isHigh ? 'rgba(245,108,108,0.28)' : 'rgba(0,124,247,0.28)'

      ctx.clearRect(0, 0, size, size)

      // 外圈细描边
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.strokeStyle = borderColor
      ctx.lineWidth = 0.1
      ctx.stroke()

      // 裁剪进圆内
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2)
      ctx.clip()

      // 底色
      ctx.fillStyle = fillColor
      ctx.fillRect(0, 0, size, size)

      // 液面高度（使用率越高液面越高）
      const liquidHeight = size - (usage / 100) * size

      ctx.fillStyle = bgColor
      ctx.fillRect(0, liquidHeight, size, size)

      // 波浪
      const waveOffset = Date.now() / 1000
      ctx.beginPath()
      ctx.moveTo(0, liquidHeight + Math.sin(waveOffset) * 4)
      for (let x = 0; x <= size; x += 6) {
        const y = liquidHeight + Math.sin(x * 0.045 + waveOffset) * 4
        ctx.lineTo(x, y)
      }
      ctx.lineTo(size, size)
      ctx.lineTo(0, size)
      ctx.closePath()

      const gradient = ctx.createLinearGradient(0, liquidHeight, 0, size)
      gradient.addColorStop(0, gradStart)
      gradient.addColorStop(1, gradEnd)
      ctx.fillStyle = gradient
      ctx.fill()

      // 主高光
      ctx.save()
      ctx.beginPath()
      ctx.translate(cx - radius * 0.16, cy - radius * 0.6)
      ctx.scale(2.6, 1)
      const hl = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.2)
      hl.addColorStop(0, 'rgba(255,255,255,0.65)')
      hl.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.arc(0, 0, radius * 0.3, 0, Math.PI * 2)
      ctx.fillStyle = hl
      ctx.fill()
      ctx.restore()

      // 边缘反光
      ctx.save()
      ctx.beginPath()
      ctx.translate(cx + radius * 0.6, cy - radius * 0.4)
      ctx.scale(1.7, 2.4)
      const eh = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.15)
      eh.addColorStop(0, 'rgba(255,255,255,0.45)')
      eh.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.arc(0, 0, radius * 0.15, 0, Math.PI * 2)
      ctx.fillStyle = eh
      ctx.fill()
      ctx.restore()

      ctx.restore()

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [size])

  return <canvas ref={canvasRef} className="block" aria-hidden />
}
