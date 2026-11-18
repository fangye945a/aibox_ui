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

// 获取控制器基本信息
export function getMnitoring(params, signal) {
  return request({
    url: '/api/monitoring/data',
    method: 'get',
    mode,
    params,
    signal,
    silentError: true
  })
}
