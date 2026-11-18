import request from '@/lib/request'
import type { SystemInfo } from '@/types/api'

/** 控制器基本信息（含内存/存储/网络/CPU/温度/开机时长） */
export function getInfo() {
  return request<SystemInfo>({ url: '/api/system/info', method: 'GET' })
}

/** 重启控制器 */
export function restart() {
  return request<boolean>({ url: '/api/system/restart', method: 'POST' })
}
