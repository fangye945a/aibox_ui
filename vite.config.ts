import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { compression } from 'vite-plugin-compression2'
import path from 'node:path'
import { mockServer } from './vite-plugin-mock-server.ts'

// 部署约束与原 vue.config.js 保持一致：
//   publicPath './'  -> base: './'
//   端口 9101
//   /api 代理到 VUE_APP_BASE_URL（去掉 /api 前缀）
//   gzip 产物，阈值 10KB，压缩率 < 0.8 才压缩
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_BASE_URL || env.VUE_APP_BASE_URL || 'http://127.0.0.1:5000'

  // Mock 默认开启，便于无设备时演示；接真机时把 .env 的 VITE_MOCK 设为 0
  const mockEnabled = env.VITE_MOCK !== '0' && mode !== 'production' && env.VITE_DEMO !== '1'

  // 部署到 GitHub Pages 时必须用绝对 base（/aibox_ui/），否则嵌套路由下
  // 相对路径会解析到错误层级；设备端部署继续用 './' 保持原行为
  const base = env.VITE_BASE_PATH || './'

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      // Mock 插件必须排在代理之前生效（middleware 顺序）
      mockEnabled ? mockServer() : null,
      compression({
        algorithms: ['gzip'],
        include: [/\.(js|css|html)$/i],
        threshold: 10240,
        deleteOriginalAssets: false,
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    // 依赖预构建缓存固定到独立目录，避免 vite 每次启动尝试删除旧缓存
    // （某些宿主环境的安全删除守卫会拦截 node_modules/.vite 的批量删除）
    cacheDir: 'node_modules/.vite-cache',
    server: {
      port: 9101,
      strictPort: true,
      host: true,
      proxy: {
        // Mock 关闭时才会走到这里，转发到真实设备
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
        '/vnc': {
          target: proxyTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'static',
      sourcemap: false,
      // 设备端浏览器内核偏旧，目标对齐 Chrome 87 / Safari 14
      target: ['chrome87', 'safari14'],
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          // Vite 8 / Rollup 4 中 manualChunks 仅支持函数形式
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return
            if (id.includes('echarts') || id.includes('zrender')) return 'echarts'
            if (
              id.includes('/react/') ||
              id.includes('react-dom') ||
              id.includes('react-router') ||
              id.includes('scheduler')
            ) {
              return 'react'
            }
          },
        },
      },
    },
  }
})
