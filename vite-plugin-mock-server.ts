import type { Plugin, ViteDevServer } from 'vite'
import type { Socket } from 'node:net'

/**
 * 开发态 Mock 后端
 *
 * 关键设计决策（踩坑记录）：
 *
 * 一、为什么走 WebSocket 而不是 SSE
 *   Vite dev server 的中间件链（CORS / compression / 缓存）会在响应头发出后
 *   继续尝试 setHeader，长连接场景下直接抛
 *   "Cannot set headers after they are sent"，甚至 ERR_STREAM_WRITE_AFTER_END 崩溃。
 *   因此本插件不自己实现 /api/sse/connect 的 HTTP 长连接，而是：
 *     - HTTP 端把请求登记后立即返回 200（让前端 fetch 正常结束）
 *     - 真正的数据通过 Vite 自带 HMR WebSocket 的自定义事件推送
 *     - 前端 useDeviceSse 在 mock 模式下订阅该事件
 *   生产构建不包含任何 mock 代码，真实设备仍走原生 SSE。
 *
 * 二、为什么不打包进 bundle
 *   插件 apply: 'serve'，只在 dev 生效；前端侧通过 import.meta.env.DEV 判断，
 *   Rollup 会把 mock 分支当作死代码摇掉。
 */

/* ─────────────── 内存态 ─────────────── */

interface MockState {
  bootTime: number
  tick: number
  logPath: string
  vnc: { server: string; port: number }
  uploads: Map<string, { received: number; total: number }>
  /** 活跃的推送通道：channelId -> 清理函数 */
  channels: Map<string, () => void>
}

const state: MockState = {
  bootTime: 3 * 24 * 3600 + 7 * 3600 + 52 * 60,
  tick: 0,
  logPath: '/var/log/zaioh',
  vnc: { server: '127.0.0.1', port: 5900 },
  uploads: new Map(),
  channels: new Map(),
}

const ok = <T>(data: T, msg = 'success') => ({ code: 0, msg, data })

/** 带相位漂移的伪随机值，页面上的数字看起来在动但不乱跳 */
function drift(base: number, amp: number, phase = 0): number {
  return Number((base + Math.sin(state.tick / 3 + phase) * amp).toFixed(2))
}

/* ─────────────── 业务数据 ─────────────── */

function systemInfo() {
  return {
    device_info: {
      product_model: 'CT21B-PRO',
      device_id: 'ZIO-CT21B-20261117-0042',
      system_version: 'OpenHarmony 5.0.0 Release (build 1128)',
      memory_type: 'LPDDR4X 8GB',
      storage: 128,
      storage_expansion: 512,
      compute_power: 6,
    },
    memory_info: {
      memory_used: drift(3.42, 0.28),
      memory: 8,
      rate: Math.round(drift(42.7, 3.4, 1)),
    },
    storage_info: {
      storage: 128,
      storage_used: 38.6,
      storage_can_used: 71.2,
      storage_system_used: 18.2,
    },
    storage_expansion_info: {
      storage_expansion: 512,
      storage_expansion_used: 264.8,
      storage_expansion_can_used: 247.2,
    },
    cpu_usage: Math.round(drift(37, 9, 2)),
    cpu_temperature: Math.round(drift(52, 3, 3)),
    boot_time: state.bootTime,
    network_info: [
      {
        type: 'ethernet',
        status: 1,
        interface: 'eth0',
        IP: '192.168.250.26',
        gateway: '192.168.250.1',
        subnet_mask: '255.255.255.0',
        DNS: '223.5.5.5',
      },
      {
        type: 'wifi',
        status: 1,
        interface: 'wlan0',
        IP: '192.168.250.26',
        gateway: '192.168.250.1',
        subnet_mask: '255.255.255.0',
        DNS: '223.5.5.5',
      },
      {
        type: 'ethernet',
        status: 0,
        interface: 'eth1',
        IP: '—',
        gateway: '—',
        subnet_mask: '—',
        DNS: '—',
      },
      {
        type: 'ethernet',
        status: 0,
        interface: 'eth2',
        IP: '—',
        gateway: '—',
        subnet_mask: '—',
        DNS: '—',
      },
    ],
  }
}

function monitoringList(type: string, start: string, end: string) {
  const s = new Date(start.replace(' ', 'T')).getTime()
  const e = new Date(end.replace(' ', 'T')).getTime()
  if (!Number.isFinite(s) || !Number.isFinite(e) || s >= e) return []

  const step = Math.max(60_000, Math.floor((e - s) / 40))
  const profiles: Record<string, { base: number; amp: number; int: boolean }> = {
    cpu_usage: { base: 38, amp: 16, int: false },
    memory_used: { base: 44, amp: 6, int: false },
    uplink_network: { base: 820, amp: 520, int: true },
    downstream_network: { base: 1450, amp: 900, int: true },
    disk_read_rate: { base: 210, amp: 160, int: true },
    disk_write_rate: { base: 95, amp: 70, int: true },
  }
  const p = profiles[type] ?? { base: 40, amp: 10, int: false }
  const out: Array<{ time: string; value: number }> = []
  let i = 0
  for (let t = s; t <= e; t += step) {
    const d = new Date(t)
    const pad = (n: number) => String(n).padStart(2, '0')
    const v = Math.max(
      0,
      p.base + Math.sin(i / 2.2) * p.amp + Math.sin(i / 7) * p.amp * 0.4,
    )
    out.push({
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      value: p.int ? Math.round(v) : Number(v.toFixed(1)),
    })
    i++
  }
  return out
}

const LOG_FILES = [
  { name: 'app', type: 'folder', path: '/var/log/zaioh/app', last_modified: '2026-11-17 11:32:08' },
  { name: 'kernel', type: 'folder', path: '/var/log/zaioh/kernel', last_modified: '2026-11-17 11:30:44' },
  { name: 'system.log', type: 'file', suffix: '.log', path: '/var/log/zaioh', last_modified: '2026-11-17 11:31:52' },
  { name: 'plc_vm.log', type: 'file', suffix: '.log', path: '/var/log/zaioh', last_modified: '2026-11-17 11:28:10' },
  { name: 'modbus_rtu.log', type: 'file', suffix: '.log', path: '/var/log/zaioh', last_modified: '2026-11-17 11:12:36' },
  { name: 'ota_agent.log', type: 'file', suffix: '.log', path: '/var/log/zaioh', last_modified: '2026-11-16 22:04:18' },
  { name: 'network.log', type: 'file', suffix: '.log', path: '/var/log/zaioh', last_modified: '2026-11-16 19:47:02' },
  { name: 'readme', type: 'file', suffix: '', path: '/var/log/zaioh', last_modified: '2026-10-02 09:15:00' },
]

const SAMPLE_LOG = `2026-11-17 11:31:52.118 [INFO ] [plc-vm] runtime started, cycle=10ms, tasks=6
2026-11-17 11:31:52.204 [INFO ] [modbus] slave addr=0x01, baud=13300, parity=N, 8N1
2026-11-17 11:31:52.441 [DEBUG] [modbus] read holding registers addr=0x0000 len=12 -> ok (12ms)
2026-11-17 11:31:53.002 [INFO ] [plc-vm] var DB1.gate_open = TRUE
2026-11-17 11:31:53.517 [DEBUG] [plc-vm] scan cycle 100/100 completed in 9.2ms
2026-11-17 11:31:54.008 [WARN ] [modbus] CRC mismatch on frame, retry 1/3
2026-11-17 11:31:54.421 [INFO ] [modbus] retry succeeded after 413ms
2026-11-17 11:31:55.330 [INFO ] [system] heartbeat ok, uptime=3d07h52m, mem=42.7%
2026-11-17 11:31:56.104 [ERROR] [ota-agent] version manifest fetch failed: connection reset
2026-11-17 11:31:56.892 [INFO ] [ota-agent] fallback to local manifest cache
2026-11-17 11:31:58.003 [DEBUG] [net] eth0 link up, speed=1000Mbps, duplex=full
2026-11-17 11:32:00.227 [INFO ] [plc-vm] cycle jitter 0.8ms (p99), within budget
2026-11-17 11:32:02.661 [INFO ] [system] log rotation check: 3 files, 18.4MB total
2026-11-17 11:32:05.119 [WARN ] [plc-vm] task 'grate_control' overran deadline by 1.4ms
2026-11-17 11:32:08.774 [INFO ] [system] snapshot written to /data/snapshot/20261117-113208
`

const DMESG_LINES = [
  '[    0.000000] Booting Linux on physical CPU 0x0000000000 [0x412fd050]',
  '[    0.000000] Linux version 5.10.110-zaioh (oe-user@buildhost) #1 SMP PREEMPT',
  '[    0.000000] Machine model: ZaiHong CT21B Industrial Controller',
  '[    0.000000] Memory: 7942MB available, 128MB reserved for CMA',
  '[    0.412118] rk3506-pinctrl ff3e0000.pinctrl: probe ok',
  '[    0.688204] mmc0: SDHCI controller on ff5c0000.mmc using ADMA',
  '[    1.204336] dwc3 ff4c0000.usb: runtime PM available',
  '[    2.118902] stmmac ff1a0000.ethernet eth0: Link is Up - 1Gbps/Full',
  '[    3.447281] rcu: INFO: Preemptible hierarchical RCU implementation',
  '[    8.204117] systemd[1]: Started OpenHarmony Application Service.',
  '[   12.881043] plc-vm[412]: task scheduler initialized, 6 tasks, tick=1ms',
  '[   14.002318] modbus[438]: serial port /dev/ttyS3 opened at 13300 8N1',
  '[   28.114073] thermal thermal_zone0: temperature=52C, trip_point_0=70C',
  '[   61.004882] ota-agent[512]: standby, waiting for signed manifest',
  '[  120.771004] net eth0: rx errors=0, tx errors=0, dropped=0',
  '[  240.118224] cpu: idle 61%, user 33%, sys 6%',
]

function ts(): string {
  const d = new Date()
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
}

function hilogLine(seq: number): string {
  const tpl = [
    `[INFO ] [system] heartbeat seq=${seq}, mem=${(38 + Math.random() * 12).toFixed(1)}%, cpu=${Math.floor(30 + Math.random() * 40)}%`,
    `[DEBUG] [plc-vm] scan ${seq} completed in ${(8 + Math.random() * 3).toFixed(1)}ms`,
    `[INFO ] [modbus] poll slave 0x01 ok, ${Math.floor(10 + Math.random() * 8)} registers`,
    `[WARN ] [plc-vm] deadline overrun ${(0.2 + Math.random() * 2).toFixed(1)}ms, task=grate_control`,
    `[DEBUG] [net] eth0 rx=${Math.floor(120 + Math.random() * 900)}B tx=${Math.floor(80 + Math.random() * 600)}B`,
    `[INFO ] [ota-agent] heartbeat, manifest_version=2.0.3`,
  ]
  return `${ts()} ${tpl[seq % tpl.length]}`
}

/* ─────────────── 路由 ─────────────── */

function readBody(req: { on: (ev: string, cb: (c: Buffer) => void) => void }): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
  })
}

function sendJson(res: import('node:http').ServerResponse, payload: unknown, status = 200) {
  if (res.writableEnded || res.headersSent) return
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(payload))
}

function sendBlob(
  res: import('node:http').ServerResponse,
  filename: string,
  content: Buffer,
  mime = 'application/octet-stream',
) {
  if (res.writableEnded || res.headersSent) return
  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    'Content-Length': String(content.length),
  })
  res.end(content)
}

/** 推送函数类型：把一条消息推给订阅了某通道的所有前端 */
type Emit = (channelId: string, payload: string) => void

async function handle(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  next: () => void,
  emit: Emit,
) {
  const url = new URL(req.url ?? '/', 'http://mock.local')
  const path = url.pathname.replace(/^\/api/, '')
  const method = (req.method ?? 'GET').toUpperCase()
  const body = method === 'POST' ? await readBody(req) : ''
  const json = () => {
    try {
      return JSON.parse(body || '{}')
    } catch {
      return {}
    }
  }

  state.tick += 1
  if (state.tick % 10 === 0) state.bootTime += 1

  /* ---- 鉴权 ---- */
  if (path === '/login' && method === 'POST') {
    const { user_name, password } = json()
    if (!user_name || !password) {
      sendJson(res, { code: 4001, msg: '账号或密码不能为空', data: null })
      return
    }
    sendJson(
      res,
      ok({
        token: 'mock-token-' + Math.random().toString(36).slice(2),
        is_first_login: false,
        user_name,
      }),
    )
    return
  }

  if (path === '/logout') {
    sendJson(res, ok(true))
    return
  }

  const auth = String(req.headers.authorization ?? '')
  if (!auth.startsWith('Bearer mock-token-') && !auth.startsWith('Bearer dev-')) {
    sendJson(res, { code: -1, msg: '登录已失效，请重新登录', data: null })
    return
  }

  if (path === '/password/change') {
    sendJson(res, ok(true, '密码修改成功'))
    return
  }

  /* ---- 系统 ---- */
  if (path === '/system/info') {
    sendJson(res, ok(systemInfo()))
    return
  }
  if (path === '/system/restart') {
    state.bootTime = 0
    sendJson(res, ok(true, '重启指令已下发'))
    return
  }

  /* ---- 监控 ---- */
  if (path === '/monitoring/data') {
    const type = url.searchParams.get('type') ?? 'cpu_usage'
    const list = monitoringList(
      type,
      url.searchParams.get('start_time') ?? '',
      url.searchParams.get('end_time') ?? '',
    )
    sendJson(res, ok([{ type, list }]))
    return
  }

  /* ---- 日志 ---- */
  if (path === '/logs/getConfig') {
    sendJson(res, ok({ log_path: state.logPath }))
    return
  }
  if (path === '/logs/setConfig') {
    state.logPath = json().log_path || state.logPath
    sendJson(res, ok(true, '路径已保存'))
    return
  }
  if (path === '/logs/list') {
    const b = json()
    const page = b.page ?? 1
    const limit = b.limit ?? 10
    let files: unknown[] = LOG_FILES
    if (b.log_dir && String(b.log_dir).endsWith('/app')) {
      files = [
        { name: 'app.log', type: 'file', suffix: '.log', path: b.log_dir, last_modified: '2026-11-17 11:32:08' },
        ...Array.from({ length: 22 }, (_, i) => ({
          name: `app-${String(i + 1).padStart(3, '0')}.log`,
          type: 'file',
          suffix: '.log',
          path: b.log_dir,
          last_modified: `2026-11-${String(16 - Math.floor(i / 4)).padStart(2, '0')} 0${i % 10}:12:0${i % 10}`,
        })),
      ]
    }
    const start = (page - 1) * limit
    sendJson(res, ok({ files: files.slice(start, start + limit), pagination: { total: files.length } }))
    return
  }
  if (path === '/logs/view') {
    sendJson(res, ok({ content: SAMPLE_LOG }))
    return
  }
  if (path === '/logs/download') {
    sendBlob(res, 'logs.zip', Buffer.from('PK\u0003\u0004 mock zip', 'utf-8'), 'application/zip')
    return
  }
  if (path === '/logs/export_realtime') {
    const b = json()
    const content =
      b.type === 'dmesg'
        ? DMESG_LINES.join('\n')
        : Array.from({ length: 200 }, (_, i) => hilogLine(i)).join('\n')
    sendBlob(res, `${b.type}.log`, Buffer.from(content, 'utf-8'), 'text/plain; charset=utf-8')
    return
  }
  if (path === '/logs/dmesg' || path === '/logs/hilog') {
    // 真实后端在此才开始推送；mock 侧通道已在连接时启动，这里幂等即可
    sendJson(res, ok(true))
    return
  }

  /* ---- SSE：HTTP 侧只登记通道，数据走 WS 推送 ---- */
  if (path === '/sse/connect') {
    const type = url.searchParams.get('type') ?? ''
    const id = url.searchParams.get('id') ?? 'x'
    // 立刻回 200，前端 fetch 结束；数据由 mock:sse 事件送出
    sendJson(res, ok({ channel: id, type, transport: 'mock-ws' }))
    return
  }
  if (path === '/sse/disconnect') {
    const id = url.searchParams.get('id') ?? ''
    state.channels.get(id)?.()
    state.channels.delete(id)
    sendJson(res, ok(true))
    return
  }

  /* ---- 远程桌面 ---- */
  if (path === '/remote/vnc/config') {
    sendJson(res, ok(state.vnc))
    return
  }
  if (path === '/remote/vnc/setConfig') {
    Object.assign(state.vnc, json())
    sendJson(res, ok(true))
    return
  }
  if (path === '/remote/connect') {
    // 用一个内置的 data URL 占位页，演示 iframe 承载
    sendJson(
      res,
      ok({
        url: 'about:blank',
        connection_id: 'vnc-' + Date.now(),
      }),
    )
    return
  }
  if (path === '/remote/disconnect') {
    sendJson(res, ok(true))
    return
  }
  if (path === '/remote/ping') {
    sendJson(res, ok({ reachable: true, latency_ms: 4 }))
    return
  }

  /* ---- 分片上传 ---- */
  if (path === '/upgrade/upload' && method === 'POST') {
    const pick = (name: string) => {
      const m = body.match(new RegExp(`name="${name}"\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--`))
      return m ? m[1] : ''
    }
    const chunkNo = Number(pick('chunk_number')) || 0
    const total = Number(pick('total_chunks')) || 1
    const uploadId = pick('upload_id') || 'default'
    state.uploads.set(uploadId, { received: chunkNo + 1, total })
    const percentage = Math.min(100, Math.round(((chunkNo + 1) / total) * 100))
    setTimeout(() => {
      sendJson(
        res,
        ok({
          upload_id: uploadId,
          uploaded_chunks: chunkNo + 1,
          total_chunks: total,
          percentage,
          completed: percentage >= 100,
        }),
      )
    }, 260)
    return
  }
  if (path.startsWith('/upgrade/progress/')) {
    const s = state.uploads.get(path.split('/').pop() ?? '')
    sendJson(
      res,
      ok(
        s
          ? {
              uploaded_chunks: s.received,
              total_chunks: s.total,
              percentage: Math.round((s.received / s.total) * 100),
            }
          : { uploaded_chunks: 0, total_chunks: 1, percentage: 0 },
      ),
    )
    return
  }

  sendJson(res, { code: 404, msg: `Mock 未实现：${method} ${path}`, data: null }, 404)
  void next
  void emit
}

/* ─────────────── 插件 ─────────────── */

export function mockServer(): Plugin {
  let enabled = false

  return {
    name: 'zaioh-mock-server',
    apply: 'serve',
    configResolved(config) {
      enabled = config.mode !== 'production'
    },
    configureServer(server: ViteDevServer) {
      if (!enabled) return

      /** 通道 -> 推送定时器；用 WS 推给浏览器，避开中间件缓冲 */
      const timers = new Map<string, ReturnType<typeof setInterval>>()

      const startChannel = (type: string, channelId: string) => {
        if (timers.has(channelId)) return

        if (type === 'dmesg') {
          // 全量快照语义：连上即推一次，之后不再变
          server.ws.send({
            type: 'custom',
            event: 'mock:sse',
            data: { channel: channelId, payload: DMESG_LINES.join('\n'), full: true },
          })
          return
        }

        let seq = 0
        const timer = setInterval(() => {
          seq++
          if (type === 'runningStatus') {
            // 字段语义：memory=已用GB，memory_used=使用率%
            server.ws.send({
              type: 'custom',
              event: 'mock:sse',
              data: {
                channel: channelId,
                payload: JSON.stringify({
                  memory: drift(3.42, 0.3),
                  memory_used: Math.round(drift(42.7, 4, 1)),
                  cpu_usage: Math.round(drift(37, 11, 2)),
                  cpu_temperature: Math.round(drift(52, 3, 3)),
                }),
              },
            })
          } else {
            server.ws.send({
              type: 'custom',
              event: 'mock:sse',
              data: { channel: channelId, payload: hilogLine(seq) },
            })
          }
        }, type === 'runningStatus' ? 1500 : 220)
        timers.set(channelId, timer)
        state.channels.set(channelId, () => {
          clearInterval(timer)
          timers.delete(channelId)
        })
      }

      // 前端通过 WS 消息主动订阅（携带 channel 与 type）
      server.ws.on('mock:sse:subscribe', (data: { channel: string; type: string }) => {
        if (!data?.channel) return
        startChannel(data.type, data.channel)
      })
      server.ws.on('mock:sse:unsubscribe', (data: { channel: string }) => {
        if (!data?.channel) return
        state.channels.get(data.channel)?.()
        state.channels.delete(data.channel)
      })

      const mw = (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: () => void) => {
        const emit: Emit = (channelId, payload) => {
          server.ws.send({
            type: 'custom',
            event: 'mock:sse',
            data: { channel: channelId, payload },
          })
        }
        void handle(req, res, next, emit)
      }
      server.middlewares.use('/api', mw)
      server.config.logger.info(
        '\n  \x1b[36m[mock]\x1b[0m 开发态 Mock 后端已启用 \x1b[2m(SSE 数据经 WebSocket 推送，不受中间件缓冲影响)\x1b[0m',
      )
    },
  }
}

/** 供 vite.config 复用：给前端注入 mock 标志 */
export const MOCK_MARK = '__ZAIOH_MOCK__'
export type { Socket }
