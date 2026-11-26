import request from "@/config/axios";

const mode = 'base'; // 对应config里的oDomains的key


// 获取远程桌面设置
export function getConfig(params) {
  return request({
    url: '/api/remote/vnc/config',
    method: 'get',
    mode,
    params
  })
}
//远程连接
export function connect(data) {
  return request({
    url: 'api/remote/connect',
    method: 'POST',
    mode,
    data
  })
}
//断开远程连接
export function disconnect(data) {
  return request({
    url: 'api/remote/disconnect',
    method: 'POST',
    mode,
    data
  })
}
//修改远程连接
export function setConfig(data) {
  return request({
    url: '/api/remote/vnc/setConfig',
    method: 'POST',
    mode,
    data
  })
}
// ping远程桌面设置
export function ping(params) {
  return request({
    url: 'api/remote/ping',
    method: 'get',
    mode,
    params
  })
}