export const videoViews = [
  { id: 'live', label: '实时检测' },
  { id: 'records', label: '检测记录' },
  { id: 'settings', label: '通道配置' },
  { id: 'models', label: '模型管理' },
  { id: 'diagnostics', label: '视频诊断' }
];

export function videoView(queryView) {
  return videoViews.find(view => view.id === queryView) ?? videoViews[0];
}
