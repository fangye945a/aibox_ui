/**
 * 后端接口契约类型定义
 * 依据原 Vue 版 src/api/*.js 与各页面消费方式反向推导，
 * 字段命名保持与后端一致（snake_case），不做重命名，降低联调风险。
 */

/** 统一信封响应。code === 0 表示业务成功，"-1" 表示登录态失效 */
export interface ApiEnvelope<T = unknown> {
  code: number | string
  msg?: string
  data: T
}

/** 登录 */
export interface LoginPayload {
  user_name: string
  /** AES-CBC 加密后的 Base64 串 */
  password: string
}

export interface LoginResult {
  token: string
  is_first_login: boolean | string
  [k: string]: unknown
}

/** 修改密码 */
export interface ChangePwdPayload {
  current_password: string
  new_password: string
}

/** 首页 — 设备信息 */
export interface DeviceInfo {
  product_model: string
  device_id: string
  system_version: string
  memory_type: string
  storage: string | number
  storage_expansion: string | number
  compute_power: string | number
}

export interface MemoryInfo {
  /** 已用内存（GB） */
  memory_used: string | number
  /** 本机总内存（GB） */
  memory: string | number
  /** 使用率百分比 */
  rate: number
}

export interface StorageInfo {
  storage: string | number
  storage_used: string | number
  storage_can_used: string | number
  storage_system_used: string | number
}

export interface StorageExpansionInfo {
  storage_expansion: string | number
  storage_expansion_used: string | number
  storage_expansion_can_used: string | number
}

export interface NetworkItem {
  type: 'wifi' | 'ethernet' | string
  status: number
  interface: string
  IP: string
  gateway: string
  subnet_mask: string
  DNS: string
}

export interface SystemInfo {
  device_info: DeviceInfo
  memory_info: MemoryInfo
  storage_info?: StorageInfo | null
  storage_expansion_info?: StorageExpansionInfo | null
  network_info?: NetworkItem[] | null
  cpu_usage: number
  cpu_temperature: number
  /** 已运行秒数 */
  boot_time: number
}

/** SSE 实时推送载荷（首页 runningStatus） */
export interface RunningStatusEvent {
  memory_used?: number
  memory?: number
  cpu_usage?: number
  cpu_temperature?: number
  [k: string]: unknown
}

/** 监控运维 */
export type MonitorIndicator =
  | 'cpu_usage'
  | 'memory_used'
  | 'uplink_network'
  | 'downstream_network'
  | 'disk_read_rate'
  | 'disk_write_rate'

export interface MonitorPoint {
  time: string
  value: number
}

export interface MonitorSeries {
  type: MonitorIndicator | string
  list: MonitorPoint[]
}

/** 日志 */
export interface LogFileItem {
  name: string
  path?: string
  type: 'folder' | 'file'
  suffix?: string
  last_modified?: string
}

export interface LogListResult {
  files: LogFileItem[]
  pagination: { total: number }
}

export interface LogListItem {
  id: number
  text: string
}

/** 系统升级分片上传进度 */
export interface UploadProgress {
  uploaded_chunks: number
  total_chunks: number
  percentage: number
  [k: string]: unknown
}

/** 远程桌面 */
export interface VncConfig {
  server: string
  port: number
  [k: string]: unknown
}

export interface RemoteConnectResult {
  url: string
  connection_id?: string
  id?: string
}
