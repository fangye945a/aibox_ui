import request from "@/config/axios";

const mode = 'base'; // 对应config里的oDomains的key

// 根据手机号模糊查询用户列表
export function getIdentityByuserId(params) {
  return request({
    url: "/v1/identity/getIdentityByuserId",
    method: 'POST',
    mode,
    params
  });
}
// 根据手机号模糊查询用户列表
export function pageListUserListByCondition(data) {
  return request({
    url: '/v1/user/pageListUserListByCondition',
    method: 'POST',
    mode,
    data
  })
}
// 获取默认密码
export function defaultPwd(params) {
  return request({
    url: '/v1/user/defaultPwd',
    method: 'get',
    mode,
    params
  })
}

// 获取控制器基本信息
export function getInfo(params) {
  return request({
    url: '/api/system/info',
    method: 'get',
    mode,
    params
  })
}

//重启控制器
export function restart(data) {
  return request({
    url: '/api/system/restart',
    method: 'POST',
    mode,
    data
  })
}