import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type AxiosInstance,
  type AxiosResponse,
} from 'axios'
import { toast } from 'sonner'
import { TOKEN_KEY } from '@/lib/utils'
import { mockAdapter } from '@/mock/adapter'

/**
 * 请求层
 *
 * 行为与迁移前 src/config/axios.js 逐条对齐，任何一条都不能自行"优化"，
 * 否则会与现网后端接口不匹配：
 *
 *  1. baseURL —— 生产同源 window.location.origin；开发走 /api 由 Vite 代理。
 *     ⚠️ 原实现里各 api 文件的 url 本身已带 /api 前缀，
 *        生产不设 baseURL、开发设 '/api' 再 rewrite 会重复。
 *        这里统一为 baseURL 留空，完全由 url 决定路径，
 *        开发代理把 /api 前缀剥掉，语义与原来等价且不会重复拼接。
 *  2. Bearer token 取 localStorage.loginToken。
 *  3. 每个请求追加 _r 时间戳，规避设备端 Web 服务缓存。
 *  4. 业务码判定：code === "0" 成功；"−1" 登录态失效；其余 toast 报错并 reject。
 *  5. data 为 null 时归一化为 true（避免调用方判空）。
 *  6. 返回已解包的 _data（不是 AxiosResponse）。
 */

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** 透传自定义配置，与迁移前的用法保持一致 */
    extData?: {
      timeout?: number
      errorMsg?: string
      timeoutMsg?: string
    }
    /** 静默模式：不弹默认错误提示，由调用方自行处理 */
    silent?: boolean
  }
}

const service: AxiosInstance = axios.create({
  // 生产环境同源；开发环境由 Vite 代理匹配 /api 前缀
  baseURL: '',
  timeout: 100_000,
  withCredentials: true,
})

/**
 * 静态演示模式：替换网络适配器为纯内存 Mock。
 *
 * 必须在这里（实例创建处）设置，而不是在 main.tsx 里改 axios 的全局 defaults ——
 * axios.create() 会在创建时拷贝当时的 defaults，事后改全局对已创建的实例无效。
 *
 * VITE_DEMO 是构建期常量，接真机的正式产物中该分支会被完全移除。
 */
if (import.meta.env.VITE_DEMO === '1') {
  service.defaults.adapter = mockAdapter
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info('[演示模式] 已启用纯前端 Mock 适配器')
  }
}

/** 登录态失效时的跳转钩子，由 router 注入，避免循环依赖 */
let onUnauthorized: (() => void) | null = null
export function registerUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

function notify(message: string, silent?: boolean) {
  if (!silent) toast.error(message)
}

service.interceptors.request.use(
  (config) => {
    if (config.extData?.timeout) {
      config.timeout = config.extData.timeout
    }

    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`)
    }

    // 缓存击穿：追加时间戳。SSE / 二进制下载同样需要
    const url = config.url ?? ''
    if (!/^https?:/i.test(url)) {
      const sep = url.includes('?') ? '&' : '?'
      config.url = `${url}${sep}_r=${Date.now()}`
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error),
)

service.interceptors.response.use(
  (response: AxiosResponse) => {
    // 二进制响应（导出、下载）直接返回 Blob，不参与业务码判定
    if (response.config.responseType === 'blob') {
      return response.data
    }

    if (!response || !response.data) {
      notify('服务器未返回数据', response?.config?.silent)
      return Promise.reject(new Error('empty response'))
    }

    let payload: unknown = response.data
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload)
      } catch {
        notify('数据格式错误', response.config.silent)
        return Promise.reject(new Error('invalid json'))
      }
    }

    if (typeof payload !== 'object' || payload === null) {
      notify('返回数据格式错误', response.config.silent)
      return Promise.reject(new Error('invalid payload'))
    }

    const data = payload as Record<string, unknown>
    const code = data.code ?? '0'

    if (String(code) === '0') {
      if (data.data === null) data.data = true
      return data
    }

    if (String(code) === '-1') {
      // 登录态失效：交给路由统一处理，不再弹错误提示
      onUnauthorized?.()
      return null
    }

    const message = typeof data.msg === 'string' ? data.msg : '服务器开了小差。'
    notify(message, response.config.silent)
    return Promise.reject(new Error(message))
  },
  (error: AxiosError) => {
    const cfg = error.config
    let message = '服务器开了小差。'

    if (error.code === 'ECONNABORTED') {
      message = '请求超时，请稍后重试'
    } else if (error.response) {
      const status = error.response.status
      const statusMap: Record<number, string> = {
        401: '未授权，请重新登录',
        403: '拒绝访问',
        404: '请求的资源不存在',
        500: '服务器内部错误',
        // Vite 代理转发失败时由 dev server 返回的网关类状态码
        502: '无法连接到设备后端，请确认设备已上电且服务正常',
        503: '设备后端暂不可用，请稍后重试',
        504: '设备后端响应超时，请检查网络链路',
      }
      message = statusMap[status] ?? `请求失败 (${status})`
    } else if (error.request) {
      // 请求已发出但无任何响应：断网、代理挂掉、跨域被拦都会落到这里
      message = '网络连接失败，请检查网络'
    } else if (error.message?.includes('JSON')) {
      message = '数据解析失败，服务器返回了无效的数据'
    }

    if (cfg?.extData?.errorMsg) {
      message = cfg.extData.errorMsg
    } else if (error.code === 'ECONNABORTED' && cfg?.extData?.timeoutMsg) {
      message = cfg.extData.timeoutMsg
    }

    notify(message, cfg?.silent)
    return Promise.reject(error)
  },
)

/**
 * 带类型的请求方法
 * - 普通响应：返回解包后的信封 { code, msg, data }
 * - responseType: 'blob'：拦截器直接返回 Blob，签名用重载表达
 */
export interface RequestFn {
  <T = unknown>(config: AxiosRequestConfig & { responseType: 'blob' }): Promise<Blob>
  <T = unknown>(
    config: AxiosRequestConfig,
  ): Promise<{ code: number | string; msg?: string; data: T }>
}

export default service as unknown as RequestFn
