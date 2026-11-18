import request from '@/lib/request'
import type { MonitorIndicator, MonitorSeries } from '@/types/api'

/**
 * 监控数据查询
 * 后端返回结构有两种形态，消费方需同时兼容：
 *   A) data: MonitorSeries[]  —— 按 type 分组
 *   B) data: { [type]: Point[] }
 */
export function getMonitoring(params: {
  type: MonitorIndicator
  start_time: string
  end_time: string
}) {
  return request<MonitorSeries[] | Record<string, MonitorSeries['list']>>({
    url: '/api/monitoring/data',
    method: 'GET',
    params,
    // 空区间是正常业务结果，不需要弹错误
    silent: true,
  })
}
