import { DMESG_LINES, hilogLine, runningStatus } from './data'

/**
 * 页内 SSE 模拟
 *
 * 静态托管没有长连接，SSE 用定时器在页内产生同样格式的消息。
 *
 * 两种运行环境：
 *   1. 开发态（npm run dev）—— 数据经 Vite HMR WebSocket 推送，
 *      由 vite-plugin-mock-server.ts 驱动（dev server 的中间件会吞掉原生 SSE）。
 *   2. 静态态（GitHub Pages）—— 完全在浏览器内用 setInterval 产生。
 *
 * 本文件只负责第 2 种，接口与第 1 种保持一致（订阅/退订 + 回调原始字符串）。
 */

type Listener = (raw: string) => void

interface Channel {
  timer: ReturnType<typeof setInterval>
  listeners: Set<Listener>
}

const channels = new Map<string, Channel>()

/** 订阅一个模拟通道，返回退订函数 */
export function subscribeMockSse(type: string, channelId: string, cb: Listener): () => void {
  // 同一通道被多个组件订阅时共用一个定时器
  let channel = channels.get(channelId)

  if (!channel) {
    const listeners = new Set<Listener>()

    if (type === 'dmesg') {
      // dmesg 是全量快照：订阅即推一次，之后不再变化。
      // 用单引号包裹 + 字面量 \n，与真机返回的 Python repr 格式一致，
      // 这样 LogStream 的解包逻辑（replace(/^'|'$/g,'').replace(/\\n/g,'\n')）可以原样复用。
      const snapshot = `'${DMESG_LINES.join('\n').replace(/\n/g, '\\n')}'`
      const timer = setTimeout(() => {
        listeners.forEach((fn) => fn(snapshot))
      }, 60) as unknown as ReturnType<typeof setInterval>
      channel = { timer, listeners }
    } else {
      let seq = 0
      const interval = type === 'runningStatus' ? 1500 : 220
      const timer = setInterval(() => {
        seq++
        const payload = type === 'runningStatus' ? runningStatus() : hilogLine(seq)
        listeners.forEach((fn) => fn(payload))
      }, interval)
      channel = { timer, listeners }
    }

    channels.set(channelId, channel)
  }

  channel.listeners.add(cb)

  return () => {
    const ch = channels.get(channelId)
    if (!ch) return
    ch.listeners.delete(cb)
    // 没有订阅者了就清掉定时器，避免页面空闲时仍在跑
    if (ch.listeners.size === 0) {
      clearInterval(ch.timer)
      channels.delete(channelId)
    }
  }
}
