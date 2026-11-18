import request from '@/lib/request'
import type {
  ChangePwdPayload,
  LoginPayload,
  LoginResult,
  UploadProgress,
} from '@/types/api'

/** 登录 */
export function login(data: LoginPayload) {
  return request<LoginResult>({ url: '/api/login', method: 'POST', data })
}

/** 退出登录 */
export function logout() {
  return request<boolean>({ url: '/api/logout', method: 'POST', silent: true })
}

/** 修改密码 */
export function changePwd(data: ChangePwdPayload) {
  return request<boolean>({ url: '/api/password/change', method: 'POST', data })
}

/** 系统升级分片上传 */
export function uploadChunk(data: FormData) {
  return request<UploadProgress>({ url: '/api/upgrade/upload', method: 'POST', data })
}

/** 查询升级进度 */
export function getProgress(params: string) {
  return request<UploadProgress>({ url: `/api/upgrade/progress/${params}`, method: 'GET' })
}
