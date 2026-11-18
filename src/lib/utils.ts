import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Tailwind 类名合并，shadcn/ui 约定 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 生成 RFC4122 v4 风格的唯一 ID，用于 SSE 会话标识与分片上传标识 */
export function uuid(): string {
  // 原实现借助 createObjectURL 取 UUID，行为不稳定且依赖 Blob；
  // 这里改用 crypto.randomUUID，并保留降级分支以兼容旧内核。
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** 秒 -> 「X小时 Y分钟 Z秒」，用于累计运行时间 */
export function formatUptime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const secs = s % 60
  const out: string[] = []
  if (hours > 0) out.push(`${hours}小时`)
  if (minutes > 0) out.push(`${minutes}分钟`)
  out.push(`${secs}秒`)
  return out.join(' ')
}

/** 字节 -> 可读大小 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/** 百分比，做了除零保护，并与原实现保持四舍五入一致 */
export function toPercent(value: number, total: number): number {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

/** YYYY-MM-DD HH:mm:ss */
export function formatDateTime(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(
    date.getHours(),
  )}:${p(date.getMinutes())}:${p(date.getSeconds())}`
}

/** YYYYMMDDHHmmss，用于导出文件名 */
export function timestampCompact(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}${p(
    date.getHours(),
  )}${p(date.getMinutes())}${p(date.getSeconds())}`
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  URL.revokeObjectURL(url)
  document.body.removeChild(a)
}

/**
 * 解析 SSE 单条消息。
 * 后端将 Python repr 直接推下来：单引号包裹 + Decimal("x") 包装，
 * 原实现用两步字符串替换兜底，这里保留同样策略并收敛到一处。
 */
export function parseSsePayload<T = Record<string, unknown>>(raw: string): T | null {
  const text = raw.trim()
  if (!text) return null
  const normalized = text
    .replace(/'/g, '"')
    .replace(/Decimal\("([^"]+)"\)/g, '$1')
  try {
    return JSON.parse(normalized) as T
  } catch {
    return null
  }
}

/** 设备 ID 缓存键，日志导出文件名依赖它 */
export const DEVICE_ID_CACHE_KEY = 'device_id_cache'
export const TOKEN_KEY = 'loginToken'
export const IS_FIRST_KEY = 'isFirst'
