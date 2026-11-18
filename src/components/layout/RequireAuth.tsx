import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { TOKEN_KEY } from '@/lib/utils'

/**
 * 路由守卫
 *
 * 行为对齐原 router.beforeEach：
 *   - 无 token → 去登录页，并把目标路径放进 redirect
 *   - 有 token → 直接放行（不做本地 token 有效期校验，由后端 code -1 兜底）
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  const token = localStorage.getItem(TOKEN_KEY)

  if (!token) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  return <>{children}</>
}
