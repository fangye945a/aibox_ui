import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { router } from '@/router'
import './index.css'

// 演示模式下 axios adapter 的安装发生在 src/lib/request.ts 内部
// （必须在实例创建处设置，改全局 defaults 对已创建实例无效），此处无需额外初始化。

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <Toaster
      position="top-center"
      richColors
      closeButton
      duration={2600}
      toastOptions={{
        style: { fontFamily: 'var(--font-sans)' },
      }}
    />
  </StrictMode>,
)
