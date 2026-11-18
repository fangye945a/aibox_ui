import { subscribeMockSse } from './sse'

/**
 * Mock 模式判定与 SSE 模拟
 *
 * 三种运行态：
 *   1. npm run dev（VITE_MOCK=1）—— Vite 插件提供 HTTP + HMR WebSocket 推送
 *   2. GitHub Pages 演示（npm run build:demo）—— axios adapter 在 src/lib/request.ts 内安装
 *   3. 生产接真机（npm run build）—— 不启用任何 Mock，直连设备
 *
 * 判定依据是构建期注入的 VITE_DEMO 常量（而非运行时 location 判断），
 * 接真机的正式产物里该分支会被完全 tree-shaking 移除。
 */

/** 是否启用纯前端 Mock（构建期常量） */
export const USE_CLIENT_MOCK = import.meta.env.VITE_DEMO === '1'

/** 订阅 mock SSE（静态演示态用页内定时器；开发态走 HMR，由 hook 自行处理） */
export function sseSubscribe(type: string, channelId: string, cb: (raw: string) => void) {
  return subscribeMockSse(type, channelId, cb)
}
