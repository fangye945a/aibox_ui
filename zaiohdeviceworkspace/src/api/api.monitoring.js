import request from "@/config/axios";

const mode = 'base'; // 对应config里的oDomains的key

// 根据手机号模糊查询用户列表
export function pageListUserListByCondition(data) {
  return request({
    url: '/v1/user/pageListUserListByCondition',
    method: 'POST',
    mode,
    data
  })
}

export const getMonitorAlerts = (page, signal) => request({
  url: '/api/monitoring/alerts', params: {page}, signal, silentError: true
});
export const clearMonitorAlerts = () => request({url: '/api/monitoring/alerts', method: 'DELETE'});
