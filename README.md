# 边缘本地控制台 · React 重构版

Vue 3 + Element Plus 旧工程（`../src`）的 React 19 全量重构版本，与旧工程**并行共存**，产物可直接替换现网 `dist`。

GitHub Pages 根地址提供新版 Vue 控制台演示。使用 `demo / Demo1234` 登录后进入视频分析，也可体验模拟远程桌面、样例固件升级、改密和监控曲线。模拟升级任务和改密仅在当前浏览器标签页生效，可在登录页恢复初始演示密码。[打开演示](https://fangye945a.github.io/aibox_ui/)

本地运行 `npm run build:workspace-demo`，将 `dist` 作为静态站点根目录即可预览 Pages 演示。

侧栏「首页」展示设备概况。「监控运维」展示整机 CPU、内存、NPU、芯片温度、网络和磁盘指标，以及系统告警记录。
点击「模拟指标超限」可体验告警的类型、原因和时间。告警保存在当前浏览器，关闭后重新打开也可查看，可通过「清除告警」删除。

「视频分析」包含实时检测、检测记录、通道配置、模型管理及视频诊断。
最多配置四路，实时检测按通道数量选择单路、双路或四宫格，可切换布局。
通道支持本地 MP4、模拟 RTSP 和 USB 视频源，以及算法模型和置信度等参数。
实际本机摄像头需要浏览器授权及 HTTPS 或本机地址。
通道配置保存在当前浏览器，临时视频文件和运行记录在刷新后重置。

「模型管理」支持本地上传、从模拟云目录下载和导出算法模型 ZIP。
ZIP 根目录应仅包含一个模型文件和 `model.json`，解压总大小不超过 64 MiB。
描述文件必填 `name`、`version`、`kind`（`person` 或 `yolo26n`）、`target`（`rk3588`）和 `file`（模型文件名），
可选 `description` 和模型文件的 `sha256`。
上传的原始 ZIP 保存在当前浏览器，可刷新后导出并在另一个浏览器重新导入。内置及模拟云目录提供演示包。

## 技术栈

| 领域 | 选型 | 版本 |
| --- | --- | --- |
| 框架 | React | 19.3.1 |
| 语言 | TypeScript | 5.9.3 |
| 构建 | Vite | 8.3.8 |
| 路由 | React Router（hash 模式） | 7.18.5 |
| 样式 | Tailwind CSS | 4.3.5 |
| 组件 | shadcn/ui 风格自建组件 + Radix UI | — |
| 图表 | ECharts（按需注册） | 6.1.0 |
| 动画 | Motion（Framer Motion 后继包） | 14.x |
| 表单 | React Hook Form + Zod | 7.x / 4.x |
| 提示 | Sonner | 2.x |

## 视觉还原

本工程的样式**严格还原原 Vue 工程**（`../src`），仅替换技术栈为 React 19 + Tailwind 4。
不做再设计 —— 运维人员已经形成的操作习惯和视觉记忆优先于"更现代"的审美。

### 色值（全部从原 SCSS 直接提取）

| 语义 | 色值 | 用途 |
| --- | --- | --- |
| 主色 | `#007CF7` | 侧栏激活态、图标、标题强调 |
| 主色浅底 | `rgba(0,124,247,0.05)` | 设备信息标题底 |
| 信息底 | `#F0F6FE` | 各页面提示条 |
| 页面底色 | `#F2F4F5` | 内容区 |
| 卡片 | `#FFFFFF` | 所有面板 |
| 分隔线 | `#EEEEEE` | 行分隔、表格线 |
| 正文 | `rgba(0,0,0,0.9)` | 标题与正文 |
| 次要文字 | `rgba(0,0,0,0.6)` | 说明、标签 |
| 成功 / 危险 | `#67C23A` / `#F56C6C` | 状态点与状态文字 |
| 链接 | `#409EFF` | 操作链接 |
| 按钮主色 | `#1890FF` hover `#62A2FA` | 主按钮 |
| 描边按钮 | `#4C95FB` | 次要按钮 |

图表色板同样还原：`#5470C6` / `rgba(5,213,180,1)` / `rgba(86,86,214,1)`。

### 尺寸规格（实测值与原工程一致）

| 元素 | 规格 |
| --- | --- |
| 字体 | `Microsoft YaHei` / `微软雅黑`，基准 14px |
| 顶栏 | 48px 高，白底 |
| 侧栏 | 220px 展开 / 64px 折叠，白底，菜单项行高 40px，字号 16px |
| 内容区 | padding `16px 24px`，底色 `#F2F4F5` |
| 卡片圆角 | 12px（内块 8px，小元素 6px，标签 4px） |
| 卡片内距 | 10px（原 `.xxx-box` 的统一规格） |
| 首页顶部横幅 | 120px 高，圆角 12px |
| 内存球 | 180×180，配色 `#007CF7` / 告警 `#F56C6C` |
| 登录表单卡 | 460px 宽，内距 `40px 38px`，输入框 48px 高 |
| 字号阶梯 | 14px（主）、16px、18px（卡片标题）、20px（页头）、24px（数值/大标题） |

### 与 Element Plus 的对应关系

原工程重度依赖 Element Plus 组件。这里用 Tailwind 复刻其观感，维度取自 Element Plus 默认值：

| 原组件 | 复刻规格 |
| --- | --- |
| `el-button` | 32px 高、14px 字、2px 圆角 |
| `el-button type="primary"` | `#1890FF` 底 / hover `#62A2FA` |
| `el-button type="danger"` | `#FF6464` 底 / hover `#F47D7D` |
| `el-input` | 32px 高、4px 圆角、边框 `#DCDFE6`、聚焦 `#409EFF` |
| `el-dialog` | 白底、标题 `#1D2129`、底部分隔线上置按钮 |
| `el-table` | 表头浅底、斑马纹、行分隔线 `#EEE` |

### 唯一的结构性调整

侧栏折叠按钮原实现是 `position: fixed`，浮在页面内容之上，会遮挡内容区左上角。
这里把它移进顶栏左侧的 64px 占位区，功能不变但不再遮挡 —— 这是原工程的一个布局缺陷，
属于必须修的问题，不涉及视觉风格改变。

### 还原度验收（CDP 读取运行时计算样式）

| 项 | 原工程 | 实际渲染 |
| --- | --- | --- |
| 正文字体 | Microsoft YaHei | ✓ |
| 正文基准字号 | 14px | ✓ |
| 顶栏高度 | 48px | ✓ |
| 侧栏宽度 | 220px | ✓ |
| 内容区 padding | 16px 24px | ✓ |
| 内容区底色 | `#F2F4F5` | ✓ |
| 卡片圆角 | 12px | ✓ |
| 顶部横幅高度 | 120px | ✓ |
| 产品名 | 24px / 700 | ✓ |
| 主按钮底色 | `#1890FF` | `rgb(24, 144, 255)` ✓ |
| 登录卡宽度 | 460px | ✓ |
| 登录标题 | 24px / 700 | ✓ |
| 登录输入框高 | 48px | ✓ |
| 内存球尺寸 | 180×180 | ✓ |

## 开发

```bash
npm install
npm run dev          # http://localhost:9101
```

### 演示模式（默认开启，无需设备）

首次拿到工程时不用等设备，直接 `npm run dev` 即可完整演示：

- 登录页底部会显示 **演示模式** 提示
- 账号 `admin`，密码 **任意 8 位以上**（校验逻辑走真实加密与提交链路）
- 首页 SSE 数字实时跳动、监控六指标趋势图、日志四类视图与实时流、
  5MB 分片上传进度、修改密码、远程桌面占位，全部可点

Mock 由 `vite-plugin-mock-server.ts` 提供，**仅 dev server 生效**，
生产构建产物里不含任何 mock 代码（可用 `grep mock-token dist/static/*.js` 验证为 0）。

### 接真实设备

修改 `.env`：

```bash
VITE_MOCK=0                                          # 关闭 Mock
VITE_BASE_URL="http://设备真实IP:5000"                 # 指向设备
```

Vite 会读 `.env` 自动重启，刷新页面即为真实请求。

> 注意：Mock 模式下 SSE 数据经 Vite 的 HMR WebSocket 推送，
> 而不是浏览器原生 SSE。原因是 dev server 的 CORS / compression 中间件
> 会在长连接响应头发出后继续 `setHeader`，导致首包被吞并触发
> `ERR_STREAM_WRITE_AFTER_END` 使进程崩溃。该分支被 `import.meta.env.DEV`
> 包裹，生产环境走标准 SSE，不影响真机联调。

## 构建

```bash
npm run build        # tsc -b 类型检查 + vite build
npm run build:only   # 跳过类型检查
```

产物在 `dist/`，约 2.0MB，gzip 后主包合计约 460KB。

## 部署（与旧工程完全一致）

| 约束 | 实现 |
| --- | --- |
| 相对路径资源 | `base: './'`，产物可直接丢进任意子目录 |
| hash 路由 | `createHashRouter`，设备端 Web 服务无需 history fallback |
| gzip 预压缩 | `vite-plugin-compression2`，阈值 10KB、仅 `.js/.css/.html` |
| 端口 | 开发 9101 |
| 接口同源 | 请求层 `baseURL: ''`，各接口 url 自带 `/api` 前缀 |

`dist/index.html` 的引用形如 `./static/index-xxx.js`，与旧产物路径布局一致，可直接替换。

> ⚠️ 若后端 nginx 未配置 gzip_static，请确认不要对 `.gz` 文件重复压缩；旧工程产出的 `.gz` 与本次命名规则一致，无需调整配置。

## 与原工程的目录对应

| 旧（Vue） | 新（React） | 说明 |
| --- | --- | --- |
| `src/config/axios.js` | `src/lib/request.ts` | 拦截器行为逐条对齐 |
| `src/api/api.*.js` | `src/api/*.ts` | 按域拆分：common / home / monitoring / log / remote |
| `src/store/index.js`（Vuex） | 无全局 store | 登录态在 `localStorage`，页面状态本地化——原 Vuex 仅存用户信息、未被业务消费 |
| `src/router/index.js` | `src/router.tsx` + `RequireAuth` | hash 路由 + 登录守卫 |
| `src/views/home.vue` | `src/pages/HomePage.tsx` | SSE 实时 + ECharts 仪表 + Canvas 液面球 |
| `src/views/monitoring.vue` + `MonitorChartPanel.vue` | `src/pages/MonitoringPage.tsx` | 六指标合并，仅渲染激活图表 |
| `src/views/log.vue` | `src/pages/LogPage.tsx` | 四类视图 + 虚拟滚动 + SSE 批量聚合 |
| `src/views/sysupdate.vue` | `src/pages/SysUpdatePage.tsx` | 5MB 分片 + CRC32 |
| `src/views/remote.vue` | `src/pages/RemotePage.tsx` | VNC iframe |
| `src/views/password.vue` + `upPwd.vue` | `PasswordPage.tsx` + `ChangePasswordDialog.tsx` | 含首次登录强制改密 |
| `src/components/slideNav.vue` / `header.vue` / `default.vue` | `components/layout/*` | 外壳重新设计 |
| `event-source-polyfill` | 原生 `fetch` + ReadableStream | 省约 40KB，行为等价 |
| `vue-virtual-scroller` | `components/VirtualList.tsx` | 自研定高虚拟滚动 |

## 关键行为保留清单（勿改）

1. **接口信封**：`code === 0` 成功；`"-1"` 登录态失效跳登录；`data === null` 归一化为 `true`。
2. **防缓存**：每个非绝对 URL 的请求追加 `_r=<timestamp>`。
3. **登录加密**：AES-256-CBC + 随机 16 字节 IV 前置，Base64；密钥与原工程逐字符一致。CryptoJS 仍由 `index.html` 全局 `<script>` 加载，**不打包**。
4. **SSE**：`Authorization` 头传 token（不加 `Bearer` 前缀）；关闭时必须调用 `/api/sse/disconnect` 释放设备端会话。
5. **dmesg 全量替换 / hilog 流式追加**：两种语义不能混用。
6. **分片上传**：5MB/片、串行、`file_hash` 为整文件 CRC32（IEEE 802.3，`0xEDB88320`）。
7. **日志上限**：前端最多保留 10000 行，超出丢最早的行。
8. **首页阈值**：内存 ≥80% 告警、CPU ≥60% 偏高、温度 ≥70℃ 告警。

## 已知差异

| 项 | 旧 | 新 | 原因 |
| --- | --- | --- | --- |
| 路由 | `/route?pageType=...` 中转页 | 直接守卫 + 跳转 | 中转页多一次渲染，无实际收益 |
| 时钟格式 | 无 | 顶部实时时钟 | 外壳重设计 |
| 侧边栏 | 纯白平铺 | 深色工业风 | 外壳重设计（已确认方向） |
| 表格 | el-table | 原生 table | 降低依赖，交互等价 |
| 日期选择 | el-date-picker | `datetime-local` | 减少 30KB 依赖 |
| 图表自适应 | 仅 window resize | ResizeObserver | 修复侧栏折叠错位 |

## 验收建议

1. `npm run build` 无 TS 报错；
2. 用真实设备验证：登录 → 首页 SSE 数字跳动 → 监控切 6 个 tab → 日志四类视图 → 分片上传 → 远程桌面 iframe 显示画面；
3. 断网重连：日志 SSE 应重试 5 次后提示；
4. 令牌失效：手动改坏 `localStorage.loginToken`，任意接口应跳回登录页并保留 redirect。
