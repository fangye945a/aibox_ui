import request from "@/config/axios";

const mode = 'base'; // 对应config里的oDomains的key

// 日志列表查询
export function getList(data) {
  return request({
    url: '/api/logs/list',
    method: 'POST',
    mode,
    data
  })
}
export function getView(data) {
  return request({
    url: '/api/logs/view',
    method: 'POST',
    mode,
    data
  })
} 
export function download(data) {
  return request({
    url: '/api/logs/download',
    method: 'POST',
    mode,
    data,
    responseType: 'blob',
  })
}
//获取日志配置路径 
export function getConfig(params) {
  return request({
    url: '/api/logs/getConfig',
    method: 'Get',
    mode,
    params
  })
}
//设置日志配置路径 
export function setConfig(data) {
  return request({
    url: '/api/logs/setConfig',
    method: 'POST',
    data
  })
}
// 断开SSE消息通道
export function disconnect(params) {
  return request({
    url: '/api/sse/disconnect',
    method: 'Get',
    mode,
    params
  })
}
//dmesg类型日志查询
export function dmesg(data) {
  return request({
    url: '/api/logs/dmesg',
    method: 'POST',
    mode,
    data
  })
}
//hilog类型日志查询
export function hilog(data) {
  return request({
    url: '/api/logs/hilog',
    method: 'POST',
    mode,
    data
  })
}
//导出实时日志（从后端缓存获取完整日志）
export function exportRealtimeLog(data) {
  return request({
    url: '/api/logs/export_realtime',
    method: 'POST',
    mode,
    data,
    responseType: 'blob'
  })
}