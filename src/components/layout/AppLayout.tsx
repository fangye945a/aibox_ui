import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import {
  Home,
  Activity,
  FileText,
  UploadCloud,
  KeyRound,
  MonitorPlay,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Ticker } from '@/components/layout/Ticker'
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog'
import { IS_FIRST_KEY, TOKEN_KEY } from '@/lib/utils'
import { logout } from '@/api/common'
import { formatDateTime } from '@/lib/utils'

/** 导航项与原 slideNav.vue 完全一致（含顺序） */
const NAV = [
  { to: '/home', label: '首页', icon: Home },
  { to: '/monitoring', label: '监控运维', icon: Activity },
  { to: '/log', label: '日志', icon: FileText },
  { to: '/sysupdate', label: '系统升级', icon: UploadCloud },
  { to: '/password', label: '修改密码', icon: KeyRound },
  { to: '/remote', label: '远程桌面', icon: MonitorPlay },
] as const

/**
 * 应用外壳 — 还原原工程 header.vue + slideNav.vue + default.vue
 *
 * 还原依据（原 SCSS 提取）：
 *   顶栏   height 48px, background #fff, 字号 20px 品牌名, 左右 padding 分段
 *   侧栏   width 220px(展开) / 64px(折叠), background #fff, 字号 16px
 *          菜单项行高 40px, 激活色 #007CF7
 *   内容区 height calc(100% - 48px), padding 16px 24px, background #F2F4F5
 *
 * 唯一的结构性调整：折叠按钮从"浮在内容上的独立块"移进侧栏顶部，
 * 因为这原本是个布局缺陷（按钮用 position:fixed 覆盖在内容上）。
 */
export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(
    () => localStorage.getItem(IS_FIRST_KEY) !== 'false',
  )
  const location = useLocation()

  async function handleLogout() {
    await logout().catch(() => {})
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(IS_FIRST_KEY)
    window.location.hash = '#/login'
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#f2f4f5]">
      {/* ── 顶栏：48px，白底 ── */}
      <header className="flex h-12 shrink-0 items-center justify-between bg-white">
        {/* 品牌区：左内距 76px 为原折叠按钮留位，现改为对齐侧栏宽度 */}
        <div className="flex h-full items-center">
          <div className="flex h-full w-16 items-center justify-center">
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="grid size-8 place-items-center rounded-[4px] text-[#666] hover:bg-[#f5f7fa]"
              aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-5" />
              ) : (
                <PanelLeftClose className="size-5" />
              )}
            </button>
          </div>
          <div className="flex items-center pr-5">
            <img
              src={new URL('@/assets/img/logo.png', import.meta.url).href}
              alt=""
              className="mr-1.5 h-7 w-auto object-contain"
            />
            <span className="text-[20px] leading-none font-semibold text-[#373737]">
              边缘本地控制台
            </span>
          </div>
        </div>

        {/* 右侧：时间 + 用户 + 登出 */}
        <div className="flex items-center gap-3 pr-6">
          <span className="tabular text-[13px] text-black/40">
            {formatDateTime(new Date()).slice(0, 10)}
          </span>
          <span className="text-[14px] text-black/20">|</span>
          <img
            src={new URL('@/assets/img/peo.png', import.meta.url).href}
            alt=""
            className="size-[35px] rounded-full object-cover"
          />
          <button
            onClick={handleLogout}
            className="grid size-6 place-items-center rounded-[4px] text-[#666] hover:bg-[#f5f7fa] hover:text-[#f56c6c]"
            aria-label="退出登录"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </header>

      {/* ── 主体：侧栏 + 内容 ── */}
      <div className="flex min-h-0 flex-1">
        {/* 侧栏：白底，展开 220px / 折叠 64px */}
        <aside
          className={cn(
            'flex shrink-0 flex-col overflow-y-auto bg-white pt-2.5',
            'transition-[width] duration-200 ease-out',
            collapsed ? 'w-16' : 'w-[220px]',
          )}
        >
          <nav>
            {NAV.map((item) => {
              const active = location.pathname.startsWith(item.to)
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'flex items-center text-[16px] transition-colors',
                    collapsed ? 'mx-2 justify-center rounded-[4px] py-2.5' : 'px-5',
                    !collapsed && 'h-10',
                    active
                      ? 'bg-[#ecf5ff] text-[#0068d0]'
                      : 'text-black hover:bg-[#f5f7fa] hover:text-[#0068d0]',
                  )}
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.8} />
                  {!collapsed && <span className="ml-2.5 truncate">{item.label}</span>}
                </NavLink>
              )
            })}
          </nav>
        </aside>

        {/* 内容区：padding 16px 24px */}
        <main className="min-h-0 flex-1 overflow-y-auto bg-[#f2f4f5] px-6 py-4">
          <Ticker />
          <Outlet />
        </main>
      </div>

      <ChangePasswordDialog
        open={pwdOpen}
        forced
        onOpenChange={(v) => setPwdOpen(v)}
        onSuccess={() => {
          localStorage.setItem(IS_FIRST_KEY, 'false')
          setPwdOpen(false)
        }}
      />
    </div>
  )
}
