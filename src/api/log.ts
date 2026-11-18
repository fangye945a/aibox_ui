import request from '@/lib/request'
import type { LogFileItem, LogListResult } from '@/types/api'

/** 日志目录列表（不含分页参数以外的过滤） */
export function getLogList(data: { page: number; limit: number; log_dir: string }) {
  return request<LogListResult>({ url: '/api/logs/list', method: 'POST', data })
}

/** 查看单个日志文件内容 */
export function getLogView(data: { name: string; log_dir?: string }) {
  return request<{ content: string }>({ url: '/api/logs/view', method: 'POST', data })
}

/** 下载日志文件 / 目录（zip） */
export function downloadLogs(data: {
  log_dir: string
  list: Array<{ name: string; type: LogFileItem['type'] }>
}) {
  return request<Blob>({
    url: '/api/logs/download',
    method: 'POST',
    data,
    responseType: 'blob',
  })
}

/** 读取日志存储路径配置 */
export function getLogConfig() {
  return request<{ log_path: string }>({ url: '/api/logs/getConfig', method: 'GET' })
}

/** 写入日志存储路径配置 */
export function setLogConfig(data: { log_path: string; device_id: string | null }) {
  return request<boolean>({ url: '/api/logs/setConfig', method: 'POST', data })
}

/** 内核日志分析（dmesg） */
export function fetchDmesg(data: {
  search_text: string
  ignore_case: boolean
  use_regex: boolean
}) {
  return request<boolean>({ url: '/api/logs/dmesg', method: 'POST', data, silent: true })
}

/** 系统日志分析（hilog） */
export function fetchHilog(data: {
  search_text: string
  ignore_case: boolean
  use_regex: boolean
}) {
  return request<boolean>({ url: '/api/logs/hilog', method: 'POST', data, silent: true })
}

/** 导出实时日志（由后端缓存整份日志） */
export function exportRealtimeLog(data: { type: 'dmesg' | 'hilog' }) {
  return request<Blob>({
    url: '/api/logs/export_realtime',
    method: 'POST',
    data,
    responseType: 'blob',
  })
}

/** 主动断开 SSE 通道，释放设备端会话 */
export function disconnectSse(params: { type: string; id: string }) {
  return request<boolean>({
    url: '/api/sse/disconnect',
    method: 'GET',
    params,
    silent: true,
  })
}
