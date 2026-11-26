const labels = {
  running: '分析中',
  reconnecting: '重连中',
  starting: '启动中',
  stopped: '已停止',
  ended: '播放结束',
  error: '运行错误',
};
const types = { running: 'success', reconnecting: 'warning', starting: 'warning', error: 'danger' };

export const stateLabel = state => labels[state] || labels.stopped;
export const stateType = state => types[state] || 'info';
export const active = item => ['running', 'starting', 'reconnecting'].includes(item?.state);
export const fps = value => (value || 0).toFixed(1);
