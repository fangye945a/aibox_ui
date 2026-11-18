import { createHashRouter, Navigate } from 'react-router'
import { registerUnauthorizedHandler } from '@/lib/request'
import { TOKEN_KEY } from '@/lib/utils'
import { AppLayout } from '@/components/layout/AppLayout'
import { RequireAuth } from '@/components/layout/RequireAuth'
import LoginPage from '@/pages/LoginPage'
import HomePage from '@/pages/HomePage'
import MonitoringPage from '@/pages/MonitoringPage'
import LogPage from '@/pages/LogPage'
import SysUpdatePage from '@/pages/SysUpdatePage'
import PasswordPage from '@/pages/PasswordPage'
import RemotePage from '@/pages/RemotePage'
import NotFoundPage from '@/pages/NotFoundPage'

/**
 * 路由
 * 使用 hash 路由——与原 createWebHashHistory 一致。
 * 原因：设备端 Web 服务不做 history fallback，产物需要能直接丢进任意静态目录。
 */
export const router = createHashRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      { path: 'home', element: <HomePage /> },
      { path: 'monitoring', element: <MonitoringPage /> },
      { path: 'log', element: <LogPage /> },
      { path: 'sysupdate', element: <SysUpdatePage /> },
      { path: 'password', element: <PasswordPage /> },
      { path: 'remote', element: <RemotePage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])

/** 业务码 -1（登录态失效）时统一登出并跳登录页 */
registerUnauthorizedHandler(() => {
  localStorage.removeItem(TOKEN_KEY)
  const current = window.location.hash.replace(/^#/, '') || '/'
  if (!current.startsWith('/login')) {
    // 保留来源，登录后可回跳
    const redirect = encodeURIComponent(current)
    window.location.hash = `#/login?redirect=${redirect}`
  }
})

export const NAV_ITEMS = [
  { to: '/home', label: '首页', icon: 'home' },
  { to: '/monitoring', label: '监控运维', icon: 'monitoring' },
  { to: '/log', label: '日志', icon: 'log' },
  { to: '/sysupdate', label: '系统升级', icon: 'update' },
  { to: '/password', label: '修改密码', icon: 'password' },
  { to: '/remote', label: '远程桌面', icon: 'remote' },
] as const
