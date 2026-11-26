import { demoEnabled, demoFetch } from '@/demo/data';

const CHECK_INTERVAL_MS = 5000;
const REQUEST_TIMEOUT_MS = 10000;

// 公共布局持有一个检查器；仅明确401或本地注销才退出，不把网络故障当作会话过期。
export function startSessionWatch(onExpired) {
  let stopped = false;
  let controller = null;
  let timeout = null;
  let interval = null;

  function stop() {
    stopped = true;
    clearInterval(interval);
    clearTimeout(timeout);
    controller?.abort();
    window.removeEventListener('online', check);
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVisible);
  }

  function expire() {
    stop();
    onExpired();
  }

  async function check() {
    if (stopped) return;
    const token = localStorage.getItem('loginToken');
    if (!token) {
      expire();
      return;
    }
    if (controller) return;
    const request = new AbortController();
    controller = request;
    timeout = setTimeout(() => request.abort(), REQUEST_TIMEOUT_MS);
    try {
      const requestFn = demoEnabled ? demoFetch : fetch;
      const response = await requestFn('/api/system/info', {
        headers: {Authorization: `Bearer ${token}`},
        cache: 'no-store',
        signal: request.signal
      });
      // 请求期间可能已在另一标签页重新登录，旧会话响应不能撤销新会话。
      if (!stopped && !request.signal.aborted && response.status === 401 &&
          localStorage.getItem('loginToken') === token) {
        expire();
      }
    } catch {
      // 断网、超时或服务异常保留登录状态，下次检查或网络恢复时重试。
    } finally {
      clearTimeout(timeout);
      controller = null;
    }
  }

  function onVisible() {
    if (!document.hidden) check();
  }

  function onStorage(event) {
    if (event.key === 'loginToken' || event.key === null) check();
  }

  window.addEventListener('online', check);
  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', onVisible);
  interval = setInterval(check, CHECK_INTERVAL_MS);
  check();
  return stop;
}
