import { useCallback, useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, Monitor, RefreshCw, Loader2 } from 'lucide-react'
import { connectRemote, disconnectRemote, getVncConfig } from '@/api/remote'
import { cn } from '@/lib/utils'
import { Panel, PageHeader } from '@/components/ui/layout-bits'
import { Button } from '@/components/ui/button'

/**
 * 远程桌面
 *
 * 与原 remote.vue 行为一致：
 *   - 挂载时读 VNC 配置，随后立即自动发起连接；
 *   - 后端返回可嵌入的 url，用 iframe 承载（sandbox 白名单照搬，不要放宽）；
 *   - 离开页面时自动断开，避免占用设备端唯一的 VNC 会话槽位。
 */
export default function RemotePage() {
  const [url, setUrl] = useState('')
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(true)
  const [error, setError] = useState('')
  const [settings, setSettings] = useState({ server: window.location.hostname, port: 0 })
  const [fullscreen, setFullscreen] = useState(false)

  const viewerRef = useRef<HTMLDivElement | null>(null)
  const connectionIdRef = useRef<string | null>(null)
  /** 防止并发建连：StrictMode 双调用与"重新连接"连点都会落到这里 */
  const connectingRef = useRef(false)

  const connect = useCallback(async () => {
    if (connectingRef.current) return
    connectingRef.current = true
    setConnecting(true)
    setError('')
    try {
      // 先释放旧会话，避免设备端 VNC 槽位被占满
      if (connectionIdRef.current) {
        await disconnectRemote({ connection_id: connectionIdRef.current }).catch(() => {})
        connectionIdRef.current = null
      }

      const cfg = await getVncConfig()
      const s = { server: window.location.hostname, port: Number(cfg.data?.port) || 0 }
      setSettings(s)

      const res = await connectRemote({
        type: 'vnc',
        server: s.server,
        port: s.port,
      })
      if (res?.code === 0) {
        connectionIdRef.current = res.data?.connection_id ?? res.data?.id ?? null
        setUrl(res.data?.url ?? '')
        setConnected(true)
      } else {
        setError(res?.msg || '连接失败')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '连接失败，请检查设备 VNC 服务')
    } finally {
      connectingRef.current = false
      setConnecting(false)
    }
  }, [])

  useEffect(() => {
    void connect()
    return () => {
      // 卸载时断开，避免会话泄漏
      if (connectionIdRef.current) {
        void disconnectRemote({ connection_id: connectionIdRef.current }).catch(() => {})
      }
    }
  }, [connect])

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      void viewerRef.current?.requestFullscreen?.()
    } else {
      void document.exitFullscreen?.()
    }
  }

  return (
    <div>
      <PageHeader
        title="远程桌面"
        description="通过 VNC 直接操作设备图形界面，适用于本地无法完成的高级配置。"
        actions={
          <Button onClick={toggleFullscreen}>
            {fullscreen ? (
              <Minimize2 className="size-3.5" />
            ) : (
              <Maximize2 className="size-3.5" />
            )}
            {fullscreen ? '退出全屏' : '全屏'}
          </Button>
        }
      />

      <Panel className="overflow-hidden">
        {/* 状态条 */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeeee] px-4 py-2.5">
          <div className="flex items-center gap-4">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-[12.5px] font-medium',
                connected ? 'text-[#67c23a]' : connecting ? 'text-[#e6a23c]' : 'text-[#f56c6c]',
              )}
            >
              <span
                className={cn(
                  'dot',
                  connected ? 'bg-[#67c23a] live-dot' : connecting ? 'bg-warning' : 'bg-[#f56c6c]',
                )}
              />
              {connected ? '已连接' : connecting ? '连接中…' : '连接失败'}
            </span>
            <span className="h-3 w-px bg-[#eeeeee]" />
            <span className="tabular text-[12px] text-black/60">
              {settings.server}:{settings.port || '—'}
            </span>
            <span className="rounded-[6px] bg-black/[0.04] px-1.5 py-0.5 text-[11px] text-black/60">
              协议 VNC
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => void connect()}
            disabled={connecting}
          >
            <RefreshCw className={cn('size-3.5', connecting && 'animate-spin')} />
            重新连接
          </Button>
        </div>

        {/* 视口 */}
        <div
          ref={viewerRef}
          className="relative h-[calc(100vh-220px)] min-h-[460px] bg-[#05080d]"
        >
          {url && (
            <iframe
              src={url}
              title="远程桌面"
              className={cn('size-full border-0 bg-black', !connected && 'hidden')}
              allow="fullscreen; autoplay; microphone; camera; display-capture; clipboard-read; clipboard-write"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-top-navigation-by-user-activation"
              referrerPolicy="no-referrer-when-downgrade"
            />
          )}

          {!connected && (
            <div className="grid size-full place-items-center px-6">
              <div className="max-w-[360px] text-center">
                {connecting ? (
                  <>
                    <Loader2 className="mx-auto size-8 animate-spin text-[#007cf7]" />
                    <p className="mt-3 text-[13px] text-white/70">正在建立远程桌面连接…</p>
                  </>
                ) : (
                  <>
                    <Monitor className="mx-auto size-9 text-white/25" strokeWidth={1.5} />
                    <p className="mt-3 text-[13.5px] font-medium text-white/80">
                      {error || '远程桌面未连接'}
                    </p>
                    <ul className="mt-4 space-y-1.5 text-left text-[12px] text-white/40">
                      {['确认设备网络可达', '确认 VNC 服务已启用', '确认防火墙放通对应端口'].map(
                        (t) => (
                          <li key={t} className="flex gap-1.5">
                            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[#007cf7]/70" />
                            {t}
                          </li>
                        ),
                      )}
                    </ul>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}
