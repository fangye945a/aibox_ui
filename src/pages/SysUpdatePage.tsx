import { useCallback, useRef, useState } from 'react'
import { UploadCloud, FileArchive, X, Loader2, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { uploadChunk } from '@/api/common'
import type { UploadProgress } from '@/types/api'
import { cn, formatFileSize, uuid } from '@/lib/utils'
import { Panel, PanelTitle, PageHeader } from '@/components/ui/layout-bits'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

/** 分片大小：5MB，与后端约定一致，不要随意调整 */
const CHUNK_SIZE = 5 * 1024 * 1024

interface PickedFile {
  file: File
  name: string
  size: number
  sizeText: string
  modifiedTime: string
  chunks: number
}

/**
 * 系统升级
 *
 * 完整保留迁移前的分片上传协议：
 *   - 每片 5MB，串行上传，不做并发（设备端 nginx 单连接更稳）；
 *   - 先对整个文件算 CRC32 作为 file_hash 一并提交，后端据此校验完整性；
 *   - upload_id 标识本次会话，进度以后端返回的 percentage 为准；
 *   - 进度到 100% 即认为接收完成，设备会自动重启并应用升级。
 */
export default function SysUpdatePage() {
  const [picked, setPicked] = useState<PickedFile | null>(null)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [elapsed, setElapsed] = useState('')
  const [hashing, setHashing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  /** 后端确认接收完成 */
  const [finished, setFinished] = useState(false)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const stopRef = useRef(false)
  const uploadIdRef = useRef<string | null>(null)
  const hashRef = useRef<string | null>(null)

  const pick = useCallback((files: FileList | null) => {
    const f = files?.[0]
    if (!f) return
    stopRef.current = false
    hashRef.current = null
    uploadIdRef.current = uuid()
    setProgress(null)
    setElapsed('')
    setFinished(false)
    setPicked({
      file: f,
      name: f.name,
      size: f.size,
      sizeText: formatFileSize(f.size),
      modifiedTime: new Date(f.lastModified).toLocaleString(),
      chunks: Math.ceil(f.size / CHUNK_SIZE),
    })
  }, [])

  function clearFile() {
    stopRef.current = true
    setPicked(null)
    setProgress(null)
    setElapsed('')
    hashRef.current = null
    uploadIdRef.current = null
    setUploading(false)
    setFinished(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function startUpload() {
    if (!picked || !uploadIdRef.current) {
      toast.error('请先选择升级文件')
      return
    }

    let hash = hashRef.current
    if (!hash) {
      try {
        setHashing(true)
        toast.info('正在计算文件校验值，请稍候…')
        hash = await crc32Hex(picked.file)
        hashRef.current = hash
        toast.success('文件解析完成，开始上传')
      } catch {
        toast.error('文件读取失败，请重新选择')
        return
      } finally {
        setHashing(false)
      }
    }

    const startedAt = Date.now()
    stopRef.current = false
    setUploading(true)

    try {
      for (let i = 0; i < picked.chunks; i++) {
        if (stopRef.current) break
        const start = i * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, picked.size)
        const fd = new FormData()
        fd.append('file', picked.file.slice(start, end))
        fd.append('file_name', picked.name)
        fd.append('chunk_number', String(i))
        fd.append('total_chunks', String(picked.chunks))
        fd.append('upload_id', uploadIdRef.current)
        fd.append('file_size', String(picked.size))
        fd.append('file_hash', hash)

        const res = await uploadChunk(fd)
        const p = res.data
        setProgress(p)

        const secs = Math.floor((Date.now() - startedAt) / 1000)
        setElapsed(
          `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`,
        )

        // 后端确认接收完成（百分比到达 100 或显式 completed），设备将自动重启升级
        if (p?.percentage >= 100 || p?.completed) {
          setFinished(true)
          setUploading(false)
          toast.success('文件接收完成，设备即将重启并执行升级', { duration: 6000 })
          return
        }
      }
      setUploading(false)
    } catch {
      setUploading(false)
      // 失败保留已选文件，允许用户重试续传
    }
  }

  const busy = uploading || hashing

  return (
    <div>
      <PageHeader
        title="系统升级"
        description="上传固件包后设备将校验完整性并自动重启更新，升级过程中请勿断电。"
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* 主区 */}
        <Panel className="p-5">
          <PanelTitle>固件文件</PanelTitle>

          {/* 拖拽区 */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              if (!busy) setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              if (!busy) pick(e.dataTransfer.files)
            }}
            onClick={() => !busy && inputRef.current?.click()}
            className={cn(
              'mt-4 flex cursor-pointer flex-col items-center justify-center rounded-[8px] border-2 border-dashed px-6 py-10 transition-colors',
              dragOver
                ? 'border-[#409eff] bg-[#ecf5ff]'
                : 'border-[#c6e2ff] bg-[rgba(0,124,247,0.04)] hover:border-[#409eff] hover:bg-[#ecf5ff]/60',
              busy && 'cursor-not-allowed opacity-60',
            )}
          >
            <div className="grid size-12 place-items-center rounded-full bg-white shadow-card">
              <UploadCloud className="size-6 text-[#007cf7]" strokeWidth={1.8} />
            </div>
            <p className="mt-3 text-[13.5px] font-medium text-black/90">
              点击选择或拖拽固件文件到此处
            </p>
            <p className="mt-1 text-[12px] text-black/60">
              支持 .tar · .gz · .img · .bin，按 5MB 自动分片上传
            </p>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => pick(e.target.files)}
            />
          </div>

          {/* 已选文件 */}
          {picked && (
            <div className="mt-4 rounded-[8px] border border-[#eeeeee]">
              <div className="flex items-center gap-3 border-b border-[#eeeeee] px-4 py-3">
                <FileArchive className="size-5 shrink-0 text-[#007cf7]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-black/90">
                    {picked.name}
                  </p>
                  <p className="tabular mt-0.5 text-[11.5px] text-black/60">
                    {picked.sizeText} · {picked.chunks} 个分片
                  </p>
                </div>
                <Button
                  variant="text"
                  size="icon-sm"
                  onClick={clearFile}
                  disabled={uploading}
                  aria-label="移除文件"
                >
                  <X className="size-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-px bg-[#eeeeee] sm:grid-cols-4">
                <Cell k="文件大小" v={picked.sizeText} />
                <Cell k="分片数量" v={`${picked.chunks} 片`} />
                <Cell k="单片大小" v="5 MB" />
                <Cell k="修改时间" v={picked.modifiedTime} />
              </div>
            </div>
          )}

          {/* 进度 */}
          {(uploading || progress) && (
            <div className="mt-4 rounded-[8px] bg-black/[0.02] px-4 py-3">
              <div className="mb-2 flex items-center justify-between text-[12px]">
                <span className="tabular text-black/90">
                  分片 {progress?.uploaded_chunks ?? 0} / {progress?.total_chunks ?? picked?.chunks}
                </span>
                <span className="tabular text-black/60">
                  {uploading && <Loader2 className="mr-1 inline size-3 animate-spin" />}
                  已用时 {elapsed || '00:00'}
                </span>
              </div>
              <Progress value={progress?.percentage ?? 0} className="h-2" />
              <div className="mt-1.5 flex items-center justify-between text-[11.5px]">
                <span className="text-black/60">上传中请勿关闭页面</span>
                <span className="tabular font-medium text-[#007cf7]">
                  {Math.round(progress?.percentage ?? 0)}%
                </span>
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center gap-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => void startUpload()}
              disabled={!picked || busy || finished}
            >
              {(uploading || hashing) && <Loader2 className="size-4 animate-spin" />}
              {hashing ? '校验中…' : uploading ? '上传中…' : '开始上传'}
            </Button>
            {picked && !uploading && finished && (
              <Button size="lg" onClick={clearFile}>
                上传下一个
              </Button>
            )}
          </div>
        </Panel>

        {/* 侧栏提示 */}
        <div className="space-y-3">
          <Panel className="p-4">
            <PanelTitle>升级须知</PanelTitle>
            <ul className="mt-3 space-y-2.5 text-[12.5px] leading-relaxed text-black/90">
              {[
                '文件接收完成后，系统将自动重启并应用升级。',
                '升级期间请保持供电与网络稳定，断电可能导致设备无法启动。',
                '上传过程按 5MB 分片串行传输，大文件耗时较长属正常现象。',
                '上传前会对整个文件计算 CRC32 校验值，用于后端完整性比对。',
              ].map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[#007cf7]" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel className="border-warning/30 bg-warning/4 p-4">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="mt-px size-4 shrink-0 text-[#e6a23c]" />
              <div>
                <p className="text-[12.5px] font-medium text-black/90">降级风险</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-black/60">
                  请确认固件型号与设备匹配。跨大版本降级可能触发数据不兼容，建议先备份配置。
                </p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="bg-white px-4 py-2.5">
      <p className="text-[11px] text-black/60">{k}</p>
      <p className="tabular mt-0.5 truncate text-[12.5px] font-medium text-black/90" title={v}>
        {v}
      </p>
    </div>
  )
}

/* ── CRC32：与原实现同一算法（IEEE 802.3 多项式 0xEDB88320） ── */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  const poly = 0xedb88320
  for (let i = 0; i < 256; i++) {
    let crc = i
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ poly : crc >>> 1
    }
    table[i] = crc
  }
  return table
})()

async function crc32Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const data = new Uint8Array(buffer)
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff]
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0')
}
