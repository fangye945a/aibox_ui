/**
 * 浏览器端 Mock 核心
 *
 * 与 vite-plugin-mock-server.ts 共用同一套业务数据与路由语义，
 * 但输出的是纯数据而非 HTTP 响应 —— 因为 GitHub Pages 是静态托管，
 * 没有 Node 进程可以运行 Vite 插件。
 *
 * 接入方式：在请求层安装 axios 拦截器（见 src/mock/index.ts），
 * 业务代码零改动。
 *
 * 数据来源与真机接口严格一致，字段名不可更改：
 *   内存语义：memory=已用GB，memory_used=使用率%
 *   dmesg 为全量快照，hilog 为逐行流
 */

/* ─────────────── 内存态 ─────────────── */

interface MockState {
  bootTime: number
  tick: number
  logPath: string
  vnc: { server: string; port: number }
  uploads: Map<string, { received: number; total: number }>
}

const state: MockState = {
  bootTime: 3 * 24 * 3600 + 7 * 3600 + 52 * 60,
  tick: 0,
  logPath: '/var/log/zaioh',
  vnc: { server: '127.0.0.1', port: 5900 },
  uploads: new Map(),
}

const ok = <T,>(data: T, msg = 'success') => ({ code: 0, msg, data })

/** 带相位漂移的伪随机值，数字看起来在动但不乱跳 */
function drift(base: number, amp: number, phase = 0): number {
  return Number((base + Math.sin(state.tick / 3 + phase) * amp).toFixed(2))
}

/* ─────────────── 业务数据 ─────────────── */

export function systemInfo() {
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

export function monitoringList(type: string, start: string, end: string) {
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
    const v = Math.max(0, p.base + Math.sin(i / 2.2) * p.amp + Math.sin(i / 7) * p.amp * 0.4)
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

export const SAMPLE_LOG = `2026-11-17 11:31:52.118 [INFO ] [plc-vm] runtime started, cycle=10ms, tasks=6
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

export const DMESG_LINES = [
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

/** hilog 逐行流：与真机日志样例格式一致 */
export function hilogLine(seq: number): string {
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

/* ─────────────── 路由分发 ─────────────── */

export interface MockRequest {
  path: string
  method: string
  query: URLSearchParams
  body: Record<string, unknown>
}

export interface MockResult {
  status?: number
  data?: unknown
}

/**
 * 处理一次 Mock 请求。
 *
 * 注意：SSE 通道（/sse/connect）不在此处理 —— 静态托管没有长连接，
 * 由 src/mock/sse.ts 用定时器在页内模拟推送。
 */
export function mockHandle(req: MockRequest): MockResult {
  const { path, method, query, body } = req

  state.tick += 1
  if (state.tick % 10 === 0) state.bootTime += 1

  /* ---- 鉴权 ---- */
  if (path === '/login' && method === 'POST') {
    const user_name = String(body.user_name ?? '')
    const password = String(body.password ?? '')
    if (!user_name || !password) {
      return { data: { code: 4001, msg: '账号或密码不能为空', data: null } }
    }
    return {
      data: ok({
        token: 'mock-token-' + Math.random().toString(36).slice(2),
        is_first_login: false,
        user_name,
      }),
    }
  }

  if (path === '/logout') return { data: ok(true) }

  if (path === '/password/change') return { data: ok(true, '密码修改成功') }

  /* ---- 系统 ---- */
  if (path === '/system/info') return { data: ok(systemInfo()) }

  if (path === '/system/restart') {
    state.bootTime = 0
    return { data: ok(true, '重启指令已下发') }
  }

  /* ---- 监控 ---- */
  if (path === '/monitoring/data') {
    const type = query.get('type') ?? 'cpu_usage'
    const list = monitoringList(
      type,
      query.get('start_time') ?? '',
      query.get('end_time') ?? '',
    )
    return { data: ok([{ type, list }]) }
  }

  /* ---- 日志 ---- */
  if (path === '/logs/getConfig') return { data: ok({ log_path: state.logPath }) }

  if (path === '/logs/setConfig') {
    state.logPath = String(body.log_path || state.logPath)
    return { data: ok(true, '路径已保存') }
  }

  if (path === '/logs/list') {
    const page = Number(body.page ?? 1)
    const limit = Number(body.limit ?? 10)
    const dir = String(body.log_dir ?? '')
    let files: unknown[] = LOG_FILES
    if (dir.endsWith('/app')) {
      files = [
        { name: 'app.log', type: 'file', suffix: '.log', path: dir, last_modified: '2026-11-17 11:32:08' },
        ...Array.from({ length: 22 }, (_, i) => ({
          name: `app-${String(i + 1).padStart(3, '0')}.log`,
          type: 'file',
          suffix: '.log',
          path: dir,
          last_modified: `2026-11-${String(16 - Math.floor(i / 4)).padStart(2, '0')} 0${i % 10}:12:0${i % 10}`,
        })),
      ]
    }
    const start = (page - 1) * limit
    return {
      data: ok({ files: files.slice(start, start + limit), pagination: { total: files.length } }),
    }
  }

  if (path === '/logs/view') return { data: ok({ content: SAMPLE_LOG }) }

  if (path === '/logs/download' || path === '/logs/export_realtime') {
    // 静态托管无法返回二进制流，返回文本让前端走 Blob 下载
    return { data: ok({ content: SAMPLE_LOG }) }
  }

  if (path === '/logs/dmesg' || path === '/logs/hilog') return { data: ok(true) }

  /* ---- 远程桌面 ---- */
  if (path === '/remote/vnc/config') return { data: ok(state.vnc) }

  if (path === '/remote/vnc/setConfig') {
    if (typeof body.port === 'number') state.vnc.port = body.port
    if (typeof body.server === 'string') state.vnc.server = body.server
    return { data: ok(true) }
  }

  if (path === '/remote/connect') {
    return { data: ok({ url: 'about:blank', connection_id: 'vnc-' + Date.now() }) }
  }

  if (path === '/remote/disconnect') return { data: ok(true) }

  if (path === '/remote/ping') return { data: ok({ reachable: true, latency_ms: 4 }) }

  /* ---- 分片上传 ---- */
  if (path === '/upgrade/upload' && method === 'POST') {
    const uploadId = String(body.upload_id ?? 'default')
    const chunkNo = Number(body.chunk_number ?? 0)
    const total = Number(body.total_chunks ?? 1)
    state.uploads.set(uploadId, { received: chunkNo + 1, total })
    const percentage = Math.min(100, Math.round(((chunkNo + 1) / total) * 100))
    return {
      data: ok({
        upload_id: uploadId,
        uploaded_chunks: chunkNo + 1,
        total_chunks: total,
        percentage,
        completed: percentage >= 100,
      }),
    }
  }

  if (path.startsWith('/upgrade/progress/')) {
    const s = state.uploads.get(path.split('/').pop() ?? '')
    return {
      data: ok(
        s
          ? {
              uploaded_chunks: s.received,
              total_chunks: s.total,
              percentage: Math.round((s.received / s.total) * 100),
            }
          : { uploaded_chunks: 0, total_chunks: 1, percentage: 0 },
      ),
    }
  }

  return { status: 404, data: { code: 404, msg: `Mock 未实现：${method} ${path}`, data: null } }
}

/** 首页运行状态快照（SSE 用） */
export function runningStatus() {
  return JSON.stringify({
    memory: drift(3.42, 0.3),
    memory_used: Math.round(drift(42.7, 4, 1)),
    cpu_usage: Math.round(drift(37, 11, 2)),
    cpu_temperature: Math.round(drift(52, 3, 3)),
  })
}
