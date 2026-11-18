import request from '@/lib/request'
import type { RemoteConnectResult, VncConfig } from '@/types/api'

/** 读取 VNC 配置 */
export function getVncConfig() {
  return request<VncConfig>({ url: '/api/remote/vnc/config', method: 'GET' })
}

/** 建立远程连接，返回可嵌入的 url */
export function connectRemote(data: { type: string; server: string; port: number }) {
  return request<RemoteConnectResult>({ url: '/api/remote/connect', method: 'POST', data })
}

/** 断开远程连接 */
export function disconnectRemote(data: { connection_id: string | null }) {
  return request<boolean>({
    url: '/api/remote/disconnect',
    method: 'POST',
    data,
    silent: true,
  })
}

/** 写入 VNC 配置 */
export function setVncConfig(data: VncConfig) {
  return request<boolean>({ url: '/api/remote/vnc/setConfig', method: 'POST', data })
}

/** 连通性探测 */
export function pingRemote(params: { server: string; port: number }) {
  return request<boolean>({ url: '/api/remote/ping', method: 'GET', params, silent: true })
}
