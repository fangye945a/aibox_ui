import { useCallback, useEffect, useRef, useState } from 'react'
import { parseSsePayload, uuid, TOKEN_KEY } from '@/lib/utils'
import { disconnectSse } from '@/api/log'
import { USE_CLIENT_MOCK, sseSubscribe } from '@/mock'

/**
 * 设备端 SSE 通道
 *
 * 三种运行态的通道来源：
 *
 *  1. 生产接真机：fetch + ReadableStream 解析真实 SSE 帧
 *     （EventSource 无法自定义 Authorization Header，故不用它）
 *
 *  2. 开发态 Mock：数据经 Vite 的 HMR WebSocket 推送
 *     原因见 vite-plugin-mock-server.ts —— dev server 的 CORS/compression
 *     中间件会在长连接响应头发出后继续 setHeader，导致首包被吞并触发
 *     ERR_STREAM_WRITE_AFTER_END 使进程崩溃。
 *
 *  3. 静态演示态（GitHub Pages）：页内定时器模拟，见 src/mock/sse.ts
 *     纯静态托管没有长连接，也没有 Node 进程可跑 Vite 插件。
 *
 * 生命周期约束（三种模式共用）：
 *  1. 连接与回调放 ref，effect 只依赖 [enabled, type]，避免重渲染反复断连；
 *  2. 回调经 latestRef 读取，永远调用最新闭包；
 *  3. StrictMode 二次挂载要能正常建连，不能"已连接就跳过"；
 *  4. 断开真机连接必须调 /api/sse/disconnect，否则设备端会话不释放。
 */

export type SseStatus = 'idle' | 'connecting' | 'open' | 'error'

interface UseDeviceSseOptions {
  type: string
  enabled: boolean
  onMessage: (raw: string) => void
  onOpen?: () => void
  maxRetries?: number
  retryDelay?: number
}

const IS_DEV = import.meta.env.DEV

export function useDeviceSse({
  type,
  enabled,
  onMessage,
  onOpen,
  maxRetries = 5,
  retryDelay = 3000,
}: UseDeviceSseOptions) {
  const [status, setStatus] = useState<SseStatus>('idle')
  const sessionRef = useRef<string>(uuid())
  const abortRef = useRef<AbortController | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retriesRef = useRef(0)
  const wantRef = useRef(false)
  const notifiedRef = useRef(false)

  const latestRef = useRef({ onMessage, onOpen })
  useEffect(() => {
    latestRef.current = { onMessage, onOpen }
  })

  const teardown = useCallback(
    (notifyServer: boolean) => {
      wantRef.current = false
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
      abortRef.current?.abort()
      abortRef.current = null
      if (notifyServer && notifiedRef.current) {
        notifiedRef.current = false
        void disconnectSse({ type, id: sessionRef.current }).catch(() => {})
      }
    },
    [type],
  )

  /** 路径一：真实 SSE */
  const openSse = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    if (!wantRef.current) return
    setStatus('connecting')

    const token = localStorage.getItem(TOKEN_KEY) ?? ''
    const url = `${window.location.origin}/api/sse/connect?type=${encodeURIComponent(
      type,
    )}&id=${encodeURIComponent(sessionRef.current)}`

    try {
      const res = await fetch(url, {
        headers: { Authorization: token },
        credentials: 'include',
        signal: controller.signal,
        cache: 'no-store',
      })
      if (!res.ok || !res.body) throw new Error(`SSE HTTP ${res.status}`)

      notifiedRef.current = true
      retriesRef.current = 0
      setStatus('open')
      latestRef.current.onOpen?.()

      const reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let boundary = buffer.search(/\r?\n\r?\n/)
        while (boundary !== -1) {
          const frame = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + (buffer[boundary] === '\r' ? 4 : 2))
          for (const line of frame.split(/\r?\n/)) {
            if (!line.startsWith('data:')) continue
            const payload = line.slice(5).trimStart()
            if (payload.trim()) latestRef.current.onMessage(payload)
          }
          boundary = buffer.search(/\r?\n\r?\n/)
        }
      }

      if (!controller.signal.aborted && wantRef.current) throw new Error('stream closed')
    } catch {
      if (controller.signal.aborted || !wantRef.current) return
      setStatus('error')
      if (retriesRef.current < maxRetries) {
        retriesRef.current += 1
        retryTimerRef.current = setTimeout(() => {
          if (wantRef.current) void openSse()
        }, retryDelay)
      }
    }
  }, [maxRetries, retryDelay, type])

  /** 路径二：开发态 Mock（HTTP 登记 + HMR WebSocket 推送） */
  const openDevMock = useCallback(async () => {
    if (!wantRef.current) return
    setStatus('connecting')
    try {
      await fetch(
        `${window.location.origin}/api/sse/connect?type=${encodeURIComponent(type)}&id=${encodeURIComponent(
          sessionRef.current,
        )}`,
        {
          headers: { Authorization: localStorage.getItem(TOKEN_KEY) ?? '' },
          credentials: 'include',
          cache: 'no-store',
        },
      )
      if (!wantRef.current) return
      notifiedRef.current = true
      setStatus('open')
      latestRef.current.onOpen?.()
    } catch {
      setStatus('error')
    }
  }, [type])

  /** 路径三：静态演示态 Mock（页内定时器） */
  const openStaticMock = useCallback(() => {
    if (!wantRef.current) return
    setStatus('open')
    latestRef.current.onOpen?.()
  }, [])

  const open = USE_CLIENT_MOCK ? openStaticMock : IS_DEV ? openDevMock : openSse

  // 开发态：订阅 HMR WebSocket 的 mock:sse 事件
  useEffect(() => {
    if (!IS_DEV || USE_CLIENT_MOCK || !enabled) return
    const channel = sessionRef.current

    const hot = (import.meta as unknown as {
      hot?: {
        send: (e: string, d: unknown) => void
        on: (e: string, cb: (d: unknown) => void) => void
        off?: (e: string, cb: (d: unknown) => void) => void
      }
    }).hot

    if (!hot) return

    const handler = (data: unknown) => {
      const d = data as { channel?: string; payload?: string; full?: boolean }
      if (!d || d.channel !== channel || typeof d.payload !== 'string') return
      latestRef.current.onMessage(d.full ? `'${d.payload.replace(/\n/g, '\\n')}'` : d.payload)
    }

    hot.on('mock:sse', handler)
    hot.send('mock:sse:subscribe', { channel, type })

    return () => {
      hot.send('mock:sse:unsubscribe', { channel })
      hot.off?.('mock:sse', handler)
    }
  }, [enabled, type])

  // 静态演示态：订阅页内定时器通道
  useEffect(() => {
    if (!USE_CLIENT_MOCK || !enabled) return
    const channel = sessionRef.current
    const unsubscribe = sseSubscribe(type, channel, (raw) => {
      latestRef.current.onMessage(raw)
    })
    return () => unsubscribe()
  }, [enabled, type])

  useEffect(() => {
    if (!enabled) {
      teardown(false)
      setStatus('idle')
      return
    }
    wantRef.current = true
    retriesRef.current = 0
    sessionRef.current = uuid()
    notifiedRef.current = false
    void open()

    return () => {
      teardown(true)
    }
    // 仅由开关与通道类型驱动；回调变化通过 latestRef 消化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, type])

  const reconnect = useCallback(() => {
    retriesRef.current = 0
    sessionRef.current = uuid()
    notifiedRef.current = false
    wantRef.current = true
    void open()
  }, [open])

  return { status, reconnect, sessionId: sessionRef.current }
}

/** 首页运行状态专用的 JSON 封装 */
export function useSseJson<T>(enabled: boolean, type = 'runningStatus') {
  const [data, setData] = useState<T | null>(null)
  const handle = useCallback((raw: string) => {
    const parsed = parseSsePayload<T>(raw)
    if (parsed) setData(parsed)
  }, [])
  const sse = useDeviceSse({ type, onMessage: handle, enabled })
  return { data, ...sse }
}
