import request from '@/config/axios';
export const login = data => request({url:'/api/login', method:'POST', data});
export const logout = () => request({url:'/api/logout', method:'POST'});
export const changePwd = data => request({url:'/api/password/change', method:'POST', data});
export const verifyPassword = data => request({url:'/api/password/verify', method:'POST', data});
export const uploads = data => request({url:'/api/upgrade/upload', method:'POST', data});
export const getProgress = id => request({url:'/api/upgrade/progress/'+encodeURIComponent(id)});
