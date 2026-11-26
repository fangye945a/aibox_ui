import axios from 'axios';
import { ElMessage } from 'element-plus';
import router from '@/router';
import { demoAdapter, demoEnabled } from '@/demo/data';

const service = axios.create({
  baseURL: '/',
  timeout: 30000,
  adapter: demoEnabled ? demoAdapter : undefined,
});
service.interceptors.request.use(config => {
  const token = localStorage.getItem('loginToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
service.interceptors.response.use(response => {
  if (response.config.responseType === 'blob') return response.data;
  const data = response.data;
  if (data && typeof data === 'object' && Number(data.code) === 0) return data;
  const message = data?.msg || '服务器返回数据格式错误';
  if (!response.config.silentError) ElMessage.error(message);
  return Promise.reject(new Error(message));
}, async error => {
  // 切页和暂停主动取消监控请求，不作为网络故障提示。
  if (axios.isCancel(error)) return Promise.reject(error);
  if (error.response?.status === 401) {
    localStorage.removeItem('loginToken');
    localStorage.removeItem('isFirst');
    await router.replace({name: 'login'});
  }
  let data = error.response?.data;
  if (data instanceof Blob) {
    try { data = JSON.parse(await data.text()); } catch { data = null; }
  }
  const message = data?.msg || data?.error || (error.code === 'ECONNABORTED' ? '请求超时，请稍后重试' : '网络请求失败');
  if (!error.config?.silentError && error.config?.url !== '/api/password/verify') {
    ElMessage.error(message);
  }
  return Promise.reject(new Error(message));
});
export default service;
