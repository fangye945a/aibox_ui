import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios'
import { mockHandle, type MockRequest } from './data'

/**
 * Mock axios 适配器
 *
 * 原理：axios 允许替换 adapter（真正的网络层）。这里自定义一个
 * 纯内存 adapter，业务代码、拦截器、错误处理全部保持不变 ——
 * 只是数据不再走网络，而是由 src/mock/data.ts 直接返回。
 *
 * 相比之下，用 axios 请求拦截器去 "短路" 会很别扭：
 * 拦截器无法伪造正常响应（必须 throw 一个假的 error 再在响应拦截器里翻回来），
 * 而 adapter 是官方提供的替换点，语义最干净。
 *
 * 只在静态演示模式下启用（见 src/mock/index.ts 的判定）。
 */

/** 把 axios 的 data 参数（可能是对象、FormData、字符串）解析成普通对象 */
function parseBody(data: unknown): Record<string, unknown> {
  if (!data) return {}

  // FormData：分片上传走的就是这条路径
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    const out: Record<string, unknown> = {}
    data.forEach((value, key) => {
      if (typeof value === 'string') out[key] = value
    })
    return out
  }

  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      return {}
    }
  }

  if (typeof data === 'object') return data as Record<string, unknown>

  return {}
}

export const mockAdapter: AxiosAdapter = async (config: AxiosRequestConfig) => {
  // axios 的 url 不含 baseURL 时直接用 config.url；这里 baseURL 为空
  const rawUrl = config.url ?? '/'
  // 前缀可能是 /api/xxx 或直接 /xxx，统一归一化
  const normalized = rawUrl.replace(/^.*?\/api\//, '/')
  const urlObj = new URL(normalized, 'http://mock.local')
  // 去掉末尾斜杠，避免 /logs/list/ 与 /logs/list 不匹配
  const path = urlObj.pathname.replace(/\/$/, '')

  const req: MockRequest = {
    path,
    method: (config.method ?? 'get').toUpperCase(),
    query: urlObj.searchParams,
    body: parseBody(config.data),
  }

  // 模拟网络延迟，让 loading 态可见（40~90ms，接近局域网设备响应）
  await new Promise((r) => setTimeout(r, 40 + Math.random() * 50))

  const result = mockHandle(req)
  const response: AxiosResponse = {
    data: result.data,
    status: result.status ?? 200,
    statusText: result.status === 404 ? 'Not Found' : 'OK',
    headers: { 'content-type': 'application/json' },
    config: config as never,
    request: { mock: true },
  }

  // 非 2xx 交给 axios 的默认校验逻辑抛错，与真实网络一致
  if ((result.status ?? 200) >= 400) {
    const err = Object.assign(new Error(`Request failed with status code ${result.status}`), {
      isAxiosError: true,
      response,
      config,
      toJSON: () => ({ message: 'mock error' }),
    })
    throw err
  }

  return response
}
