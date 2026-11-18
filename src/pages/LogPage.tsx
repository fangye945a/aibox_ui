import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ArrowDown,
  Folder,
  FileText,
  Search,
  Download,
  Play,
  Square,
  Eraser,
  Info,
  Regex,
  CaseSensitive,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getLogList,
  getLogView,
  downloadLogs,
  getLogConfig,
  setLogConfig,
  fetchDmesg,
  fetchHilog,
  exportRealtimeLog,
  disconnectSse,
} from '@/api/log'
import type { LogFileItem, LogListItem } from '@/types/api'
import { useDeviceSse } from '@/hooks/useDeviceSse'
import { useLocalStorageState } from '@/hooks/useCommon'
import {
  DEVICE_ID_CACHE_KEY,
  cn,
  downloadBlob,
  parseSsePayload,
  timestampCompact,
} from '@/lib/utils'
import { Panel } from '@/components/ui/layout-bits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { VirtualList } from '@/components/VirtualList'

type TabKey = 'files' | 'exceptions' | 'dmesg' | 'hilog'

const TABS: Array<{ key: TabKey; label: string; hint: string }> = [
  { key: 'files', label: '日志文件查询', hint: '按目录浏览' },
  { key: 'exceptions', label: '异常日志查询', hint: '错误摘要' },
  { key: 'dmesg', label: '内核日志分析', hint: '全量刷新' },
  { key: 'hilog', label: '系统日志分析', hint: '流式追加' },
]

/** 前端最多保留的日志行数，防止长时间运行后内存膨胀 */
const MAX_LOG_LINES = 10_000
/** SSE 批量聚合参数：50 条或 100ms 触发一次 flush */
const BATCH_SIZE = 50
const BATCH_INTERVAL = 100

/**
 * 日志中心
 *
 * 四类视图的功能对齐迁移前 log.vue：
 *   1. 日志文件查询：目录栈浏览、分页、查看 / 导出（多选打包 zip）
 *   2. 异常日志查询：同一套列表，不带目录参数
 *   3. 内核日志分析：SSE dmesg，全量替换语义
 *   4. 系统日志分析：SSE hilog，流式追加语义
 * 另含：日志存储路径配置、忽略大小写 / 正则开关（偏好持久化）、导出实时日志（后端缓存整份）。
 *
 * 改动说明：原版滚动监听依赖 vue-virtual-scroller 内部 DOM 结构，
 * 这里改为自研 VirtualList，滚动到底部的逻辑直接操作 scrollTop，更稳定。
 */
export default function LogPage() {
  const [tab, setTab] = useState<TabKey>('files')

  return (
    <div className="flex h-[calc(100vh-120px)] min-h-[520px] gap-3">
      {/* ── 左侧分类 ── */}
      <Panel className="flex w-[196px] shrink-0 flex-col overflow-hidden">
        <div className="border-b border-[#eeeeee] px-4 py-3">
          <h2 className="card-title">日志</h2>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {TABS.map((t) => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'relative flex w-full items-start gap-2 rounded-[6px] px-2.5 py-2 text-left transition-colors',
                  active
                    ? 'bg-[#ecf5ff] text-[#0068d0]'
                    : 'text-black/90 hover:bg-[#f5f7fa]',
                )}
              >
                {active && (
                  <span className="absolute top-1/2 left-0 h-4 w-[3px] -translate-y-1/2 rounded-r bg-[#409eff]" />
                )}
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-[13px] leading-tight', active && 'font-medium')}>
                    {t.label}
                  </span>
                  <span
                    className={cn(
                      'mt-0.5 block text-[10.5px] leading-tight',
                      active ? 'text-[#0068d0]/75' : 'text-black/60',
                    )}
                  >
                    {t.hint}
                  </span>
                </span>
              </button>
            )
          })}
        </nav>
      </Panel>

      {/* ── 右侧内容 ── */}
      <Panel className="flex min-w-0 flex-1 flex-col overflow-hidden p-4">
        {(tab === 'files' || tab === 'exceptions') && (
          <FileBrowser key={tab} mode={tab === 'files' ? 'files' : 'exceptions'} />
        )}
        {(tab === 'dmesg' || tab === 'hilog') && <LogStream key={tab} mode={tab} />}
      </Panel>
    </div>
  )
}

/* ══════════════════════════ 文件浏览 ══════════════════════════ */

function FileBrowser({ mode }: { mode: 'files' | 'exceptions' }) {
  const isFileMode = mode === 'files'
  const [rows, setRows] = useState<LogFileItem[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [logPath, setLogPath] = useState('')
  const [pathStack, setPathStack] = useState<string[]>([])
  const [viewContent, setViewContent] = useState<{ open: boolean; name: string; text: string }>({
    open: false,
    name: '',
    text: '',
  })
  const [pathDialog, setPathDialog] = useState(false)
  const [newPath, setNewPath] = useState('')

  const currentDir = isFileMode ? logPath : ''

  /**
   * 拉取当前目录列表。
   * 必须显式传入全部参数，不能依赖闭包里的 page/limit/currentDir——
   * React 状态更新是异步的，切换目录后立即调用会读到旧目录，造成列表错乱。
   */
  const fetchList = useCallback(
    async (opts: { page?: number; limit?: number; dir?: string } = {}) => {
      const p = opts.page ?? page
      const l = opts.limit ?? limit
      const dir = opts.dir ?? currentDir
      setLoading(true)
      try {
        const res = await getLogList({ page: p, limit: l, log_dir: dir })
        setRows(res.data?.files ?? [])
        setTotal(res.data?.pagination?.total ?? 0)
        setSelected(new Set())
      } catch {
        setRows([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    },
    [page, limit, currentDir],
  )

  // 初始化：先取配置里的日志目录，再拉列表
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (isFileMode) {
        try {
          const res = await getLogConfig()
          if (alive) setLogPath(res.data?.log_path ?? '')
          await fetchList({ page: 1, dir: res.data?.log_path ?? '' })
        } catch {
          /* 请求层已提示 */
        }
      } else {
        await fetchList({ page: 1, dir: '' })
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFileMode])

  function enterFolder(row: LogFileItem) {
    if (!isFileMode || row.type !== 'folder') return
    const next = logPath.endsWith('/') ? `${logPath}${row.name}` : `${logPath}/${row.name}`
    setPathStack((s) => [...s, logPath])
    setLogPath(next)
    setPage(1)
    void fetchList({ page: 1, dir: next })
  }

  function goBack() {
    if (pathStack.length === 0) return
    const parent = pathStack[pathStack.length - 1]
    setPathStack((s) => s.slice(0, -1))
    setLogPath(parent)
    setPage(1)
    void fetchList({ page: 1, dir: parent })
  }

  async function viewFile(row: LogFileItem) {
    try {
      const res = await getLogView({
        name: row.name,
        ...(isFileMode ? { log_dir: currentDir } : {}),
      })
      setViewContent({ open: true, name: row.name, text: res.data?.content || '暂无内容' })
    } catch {
      /* 请求层已提示 */
    }
  }

  async function exportFiles(target?: LogFileItem) {
    const list = target
      ? [{ name: target.name, type: target.type }]
      : rows
          .filter((r) => selected.has(r.name))
          .map((r) => ({ name: r.name, type: r.type }))
    if (list.length === 0) {
      toast.warning('请先选择要导出的文件')
      return
    }
    try {
      const blob = await downloadLogs({ log_dir: currentDir, list })
      const deviceId = localStorage.getItem(DEVICE_ID_CACHE_KEY) || 'unknown'
      const zipSuffix = list.length > 1 ? '.zip' : ''
      downloadBlob(blob, `${deviceId}_${timestampCompact()}_${list[0].name}${zipSuffix}`)
      toast.success('导出成功')
    } catch {
      /* 请求层已提示 */
    }
  }

  async function savePath() {
    if (!newPath.trim()) {
      toast.warning('请输入新的存储路径')
      return
    }
    try {
      await setLogConfig({
        log_path: newPath.trim(),
        device_id: localStorage.getItem(DEVICE_ID_CACHE_KEY),
      })
      setLogPath(newPath.trim())
      setPathStack([])
      setPage(1)
      setPathDialog(false)
      toast.success('路径已更新')
      void fetchList({ page: 1, dir: newPath.trim() })
    } catch {
      /* 请求层已提示 */
    }
  }

  function toggleRow(name: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.name)),
    )
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 顶部提示条 */}
      <div className="mb-3 flex items-center justify-between gap-3 rounded-[6px] bg-[#f0f6fe] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-[12.5px] text-black/90">
          <Info className="size-3.5 shrink-0 text-[#007cf7]" />
          {isFileMode ? (
            <span className="truncate">
              当前路径：
              <span className="font-mono text-[12px] text-black/90">{logPath || '—'}</span>
              <button
                className="ml-2 shrink-0 text-[#007cf7] hover:underline"
                onClick={() => {
                  setNewPath('')
                  setPathDialog(true)
                }}
              >
                修改存储路径
              </button>
            </span>
          ) : (
            <span>异常日志列表（固定目录，不支持切换）</span>
          )}
        </div>
        <Button variant="primary" size="sm" onClick={() => void exportFiles()}>
          <Download className="size-3" />
          导出{selected.size > 0 ? ` (${selected.size})` : ''}
        </Button>
      </div>

      {isFileMode && pathStack.length > 0 && (
        <Button
          variant="text"
          size="sm"
          className="mb-2 self-start pl-0"
          onClick={goBack}
        >
          <ChevronLeft className="size-3.5" />
          返回上级目录
        </Button>
      )}

      {/* 表格 */}
      <div className="min-h-0 flex-1 overflow-auto rounded-[8px] border border-[#eeeeee]">
        <table className="w-full border-collapse text-[12.5px]">
          <thead className="sticky top-0 z-10 bg-[rgba(0,124,247,0.05)]">
            <tr className="text-left text-black/90">
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  className="size-3.5 accent-primary"
                  checked={rows.length > 0 && selected.size === rows.length}
                  onChange={toggleAll}
                  aria-label="全选"
                />
              </th>
              <th className="px-3 py-2.5 font-medium">文件名称</th>
              <th className="px-3 py-2.5 font-medium">路径</th>
              <th className="w-[170px] px-3 py-2.5 font-medium">最新写入时间</th>
              <th className="w-[130px] px-3 py-2.5 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-black/60">
                  <Loader2 className="mx-auto size-5 animate-spin" />
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-black/60">
                  当前目录下没有日志文件
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => {
                const canView =
                  row.type === 'file' && (row.suffix === '.log' || row.suffix === '.txt')
                return (
                  <tr
                    key={row.name}
                    className={cn(
                      'border-t border-[#eeeeee] transition-colors',
                      selected.has(row.name) ? 'bg-[#ecf5ff]' : 'hover:bg-[#f5f7fa]',
                    )}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-primary"
                        checked={selected.has(row.name)}
                        onChange={() => toggleRow(row.name)}
                        aria-label={`选择 ${row.name}`}
                      />
                    </td>
                    <td className="max-w-0 px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {row.type === 'folder' ? (
                          <Folder className="size-3.5 shrink-0 text-[#e6a23c]" />
                        ) : (
                          <FileText className="size-3.5 shrink-0 text-black/60" />
                        )}
                        {row.type === 'folder' ? (
                          <button
                            onClick={() => enterFolder(row)}
                            className="truncate text-[#007cf7] hover:underline"
                          >
                            {row.name}
                          </button>
                        ) : (
                          <span className="truncate text-black/90">{row.name}</span>
                        )}
                      </div>
                    </td>
                    <td className="max-w-0 truncate px-3 py-2 font-mono text-[11.5px] text-black/60">
                      {row.path ?? '—'}
                    </td>
                    <td className="tabular px-3 py-2 text-black/60">
                      {row.last_modified ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {canView && (
                          <Button
                            variant="text"
                            size="sm"
                            className="px-1.5"
                            onClick={() => void viewFile(row)}
                          >
                            查看
                          </Button>
                        )}
                        <Button
                          variant="text"
                          size="sm"
                          className="px-1.5"
                          onClick={() => void exportFiles(row)}
                        >
                          导出
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      <div className="mt-3 flex shrink-0 items-center justify-between gap-3 text-[12px] text-black/60">
        <div className="flex items-center gap-2">
          <span className="tabular">共 {total} 条</span>
          <select
            value={limit}
            onChange={(e) => {
              const l = Number(e.target.value)
              setLimit(l)
              setPage(1)
              void fetchList({ page: 1, limit: l })
            }}
            className="h-7 rounded-[6px] border border-[#eeeeee] bg-white px-1.5 text-[12px]"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} 条/页
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            disabled={page <= 1}
            onClick={() => {
              setPage((p) => p - 1)
              void fetchList({ page: page - 1 })
            }}
          >
            上一页
          </Button>
          <span className="tabular px-2">
            {page} / {totalPages}
          </span>
          <Button
            size="sm"
            disabled={page >= totalPages}
            onClick={() => {
              setPage((p) => p + 1)
              void fetchList({ page: page + 1 })
            }}
          >
            下一页
          </Button>
        </div>
      </div>

      {/* 内容预览 */}
      <Dialog
        open={viewContent.open}
        onOpenChange={(v) => setViewContent((s) => ({ ...s, open: v }))}
      >
        <DialogContent className="max-w-[760px]">
          <DialogHeader>
            <DialogTitle className="truncate">
              日志内容 · {viewContent.name}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="max-h-[62vh] bg-[#f5f7fa] p-4">
            <pre className="font-mono text-[12.5px] leading-[1.7] whitespace-pre-wrap break-all text-black/90">
              {viewContent.text}
            </pre>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setViewContent((s) => ({ ...s, open: false }))}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 存储路径 */}
      <Dialog open={pathDialog} onOpenChange={setPathDialog}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle>修改日志存储路径</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-1.5">
              <span className="text-[12px] text-black/60">当前路径</span>
              <Input value={logPath} disabled />
            </div>
            <div className="space-y-1.5">
              <span className="text-[12px] text-black/60">新路径</span>
              <Input
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="例如 /var/log/app"
              />
            </div>
            <p className="text-[11.5px] leading-relaxed text-black/60">
              路径需为设备上真实存在的目录，修改后立即生效。
            </p>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setPathDialog(false)}>取消</Button>
            <Button variant="primary" onClick={() => void savePath()}>
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ══════════════════════════ 实时日志流 ══════════════════════════ */

function LogStream({ mode }: { mode: 'dmesg' | 'hilog' }) {
  const [running, setRunning] = useState(false)
  const [lines, setLines] = useState<LogListItem[]>([])
  const [searchText, setSearchText] = useState('')
  const [flags, setFlags] = useLocalStorageState('log_filter_flags', {
    ignoreCase: true,
    useRegex: false,
  })
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  /** 筛选条件的最新值，供 SSE onOpen 回调读取（避免闭包固化旧值） */
  const filterRef = useRef({ searchText, flags })
  filterRef.current = { searchText, flags }

  // SSE 批量聚合：高频消息先进缓冲区，定时或满 50 条再合并进 state
  const bufferRef = useRef<string[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lineIdRef = useRef(0)
  /** flush 内部读取，避免把 mode 写进依赖导致回调频繁重建 */
  const modeRef = useRef(mode)
  modeRef.current = mode

  const flush = useCallback(() => {
    const buf = bufferRef.current
    if (buf.length === 0) return

    if (modeRef.current === 'dmesg') {
      // dmesg 语义是全量快照：只取最后一条，整体替换现有内容
      const last = buf[buf.length - 1].replace(/^'|'$/g, '')
      const text = last.replace(/\\n/g, '\n')
      const arr = text.split('\n')
      setLines(arr.map((t, i) => ({ id: i, text: t || ' ' })))
      lineIdRef.current = arr.length
    } else {
      const next = buf.map((t) => ({ id: lineIdRef.current++, text: t }))
      setLines((prev) => {
        const merged = prev.concat(next)
        // 超出上限丢弃最早的行，避免长时间运行内存失控
        return merged.length > MAX_LOG_LINES
          ? merged.slice(merged.length - MAX_LOG_LINES)
          : merged
      })
    }
    bufferRef.current = []
  }, [])

  const sse = useDeviceSse({
    type: mode,
    enabled: running,
    onOpen: () => {
      // 连接建立后通知后端开始按条件推送。
      // 用 ref 读最新筛选条件：回调只会被创建一次，闭包会固化成旧值。
      const params = {
        search_text: filterRef.current.searchText,
        ignore_case: filterRef.current.flags.ignoreCase,
        use_regex: filterRef.current.flags.useRegex,
      }
      void (modeRef.current === 'dmesg' ? fetchDmesg(params) : fetchHilog(params)).catch(
        () => {},
      )
    },
    onMessage: (raw) => {
      // 回调用 ref 读回调与模式，避免闭包固化
      const current = modeRef.current
      const text = raw.trim()
      if (!text) return
      if (current === 'dmesg') {
        // 整份快照必须整体入缓冲，不能逐行拆
        bufferRef.current.push(text)
        flush()
        return
      }
      // hilog 是逐行流：先按单引号包裹解包，再尝试 JSON
      const unquoted = text.replace(/^'|'$/g, '')
      let line = unquoted
      if (unquoted.startsWith('{')) {
        const parsed = parseSsePayload<{ msg?: string }>(unquoted)
        if (parsed?.msg) line = parsed.msg
      }
      if (!line) return
      bufferRef.current.push(line)
      if (bufferRef.current.length >= BATCH_SIZE) {
        flush()
      } else {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(flush, BATCH_INTERVAL)
      }
    },
  })

  // 自动滚动到底部
  useEffect(() => {
    if (!autoScroll) return
    const el = scrollerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [lines, autoScroll])

  // 切换模式时清空
  useEffect(() => {
    setRunning(false)
    setLines([])
    bufferRef.current = []
    lineIdRef.current = 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // 停流时释放服务端会话
  const stop = useCallback(() => {
    setRunning(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    void disconnectSse({ type: mode, id: sse.sessionId }).catch(() => {})
  }, [mode, sse.sessionId])

  async function exportRealtime() {
    try {
      const blob = await exportRealtimeLog({ type: mode })
      const deviceId = localStorage.getItem(DEVICE_ID_CACHE_KEY) || 'unknown'
      downloadBlob(blob, `${deviceId}_${timestampCompact()}_${mode}.log`)
      toast.success('导出成功')
    } catch {
      /* 请求层已提示 */
    }
  }

  const scrollToBottom = () => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    setAutoScroll(true)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 工具栏 */}
      <TooltipProvider delayDuration={200}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-black/60" />
              <Input
                className="w-[260px] pl-8"
                placeholder="过滤关键字"
                value={searchText}
                disabled={running}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !running) setRunning(true)
                }}
              />
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={flags.ignoreCase ? 'outline' : 'default'}
                  onClick={() => setFlags((f) => ({ ...f, ignoreCase: !f.ignoreCase }))}
                  disabled={running}
                  aria-label="忽略大小写"
                >
                  <CaseSensitive className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {flags.ignoreCase ? '已启用：忽略大小写' : '点击启用：忽略大小写'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={flags.useRegex ? 'outline' : 'default'}
                  onClick={() => setFlags((f) => ({ ...f, useRegex: !f.useRegex }))}
                  disabled={running}
                  aria-label="正则匹配"
                >
                  <Regex className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {flags.useRegex ? '已启用：正则表达式匹配' : '点击启用：正则表达式匹配'}
              </TooltipContent>
            </Tooltip>

            {!running ? (
              <Button variant="primary" onClick={() => setRunning(true)}>
                <Play className="size-3.5" />
                开始
              </Button>
            ) : (
              <Button variant="danger" onClick={stop}>
                <Square className="size-3.5" />
                停止
              </Button>
            )}
            {running && (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[#67c23a]">
                <span className="dot live-dot bg-[#67c23a]" />
                {sse.status === 'connecting' ? '连接中…' : '接收中'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setLines([])
                bufferRef.current = []
                lineIdRef.current = 0
              }}
            >
              <Eraser className="size-3.5" />
              清除
            </Button>
            <Button variant="primary" onClick={() => void exportRealtime()}>
              <Download className="size-3.5" />
              导出
            </Button>
          </div>
        </div>
      </TooltipProvider>

      {/* 日志视口 */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[8px] border border-[#eeeeee] bg-[#f5f7fa]/60">
        {lines.length === 0 && (
          <div className="grid size-full place-items-center">
            <div className="text-center">
              <FileText className="mx-auto size-8 text-black/60/40" />
              <p className="mt-2 text-sm text-black/60">
                {running ? '已建立通道，等待日志推送…' : '点击「开始」拉取实时日志'}
              </p>
            </div>
          </div>
        )}

        <VirtualList
          items={lines}
          itemHeight={28}
          buffer={16}
          scrollerRef={scrollerRef}
          onUserScroll={() => {
            // 用户一滚动就停止自动跟随，与原版行为一致
            if (autoScroll) setAutoScroll(false)
          }}
          className="size-full overflow-y-auto px-3 py-2 font-mono text-[11.5px]"
          renderItem={(item) => (
            <div className="truncate leading-[28px] whitespace-pre text-black/90/85">
              {item.text}
            </div>
          )}
        />

        <button
          onClick={scrollToBottom}
          className={cn(
            'absolute bottom-4 left-1/2 grid size-8 -translate-x-1/2 place-items-center rounded-full bg-white/90 text-black/90 shadow-raise transition-all hover:bg-white',
            autoScroll && 'opacity-0',
          )}
          aria-label="滚动到底部"
        >
          <ArrowDown className="size-4" />
        </button>
      </div>

      <div className="mt-2 flex shrink-0 items-center justify-between text-[11px] text-black/60">
        <span className="tabular">
          已加载 {lines.length.toLocaleString()} 行
          {lines.length >= MAX_LOG_LINES && '（已达上限，早期日志自动丢弃）'}
        </span>
        <span>{autoScroll ? '自动跟随最新' : '已暂停跟随，滚到底部恢复'}</span>
      </div>
    </div>
  )
}
