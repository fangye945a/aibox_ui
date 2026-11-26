# AIBox 设备工作台原型

本仓库的 GitHub Pages 原型以仓库内 `zaiohdeviceworkspace` 为唯一入口，界面同步自 CT23/CT21B 真实工作台前端 `82d7543`。页面在浏览器中通过独立的演示适配器提供登录、数据与交互，设备生产模式仍使用原有后端 API。

演示地址：<https://fangye945a.github.io/aibox_ui/>

演示账号：

- 账号：`demo`
- 密码：`Demo1234`

## 原型范围

左侧导航与真实工作台保持一致，覆盖以下模块：

- 首页：CT23 设备概况、运行状态与产品信息。
- 监控运维：CPU、内存、NPU、温度、网络、磁盘、告警与 60 秒趋势曲线。
- 智能问答：ZaiAgent、多模型选择、Markdown 富文本、文本/Word/PDF 附件和会话状态保留。
- 视频分析：实时检测、检测记录、通道配置、模型管理、视频诊断。
- 实时检测：四宫格预览、单通道切换、四通道全屏、未配置通道引导和识别标注。模拟预览在浏览器内合成 JPEG，并复用设备版的多路预览解析流程。
- 检测记录：记录筛选、截图弹窗、识别详情。
- 通道配置：最多 32 路、修改前停止分析、USB 占用检测与共享 HUB 提示。
- 模型管理：模型列表、ZIP 导入导出和云目录占位。
- 视频诊断：预览、推理、错误与重连状态。
- 系统维护：日志、OTA、修改密码和远程操控。
- 社交平台接入：飞书、QQ、微信绑定流程演示；页面二维码为不可扫描的演示图。

演示数据在浏览器内模拟，不会写入真实设备。生产构建不会启用演示适配器。

## 工程结构

| 路径 | 作用 |
| --- | --- |
| `zaiohdeviceworkspace/` | CT23/CT21B 真实工作台前端及 Pages 演示适配层 |
| `zaiohdeviceworkspace/src/demo/` | 仅浏览器演示使用的 API、视频、智能问答和二维码模拟 |
| `.github/workflows/deploy.yml` | 构建 `dist` 并发布到 GitHub Pages |
| `src/`、`index.html`、`vite.config.ts` | 历史 React 原型，当前不参与 Pages 构建 |

## 本地运行

```bash
npm ci --prefix zaiohdeviceworkspace
npm run serve --prefix zaiohdeviceworkspace -- --mode pages
```

访问终端输出的本地地址，使用上述演示账号登录。

## 构建与检查

```bash
npm --prefix zaiohdeviceworkspace run typecheck
npm run build:workspace-demo
```

`build:workspace-demo` 会安装锁定依赖，以 `pages` 模式构建 Vue 工作台，并将产物输出到仓库根目录的 `dist/`。

## 发布

推送到 `main` 后，GitHub Actions 会执行源码检查、构建和 Pages 部署。工作流只需要以下权限：

- `contents: read`
- `pages: write`
- `id-token: write`

## 真实设备模式

设备端使用 `zaiohdeviceworkspace` 的标准构建：

```bash
npm run build --prefix zaiohdeviceworkspace
```

只有设置 `VUE_APP_PAGES_DEMO=true` 时才启用浏览器演示层。视频分析、智能问答入口分别由 `VUE_APP_WORKSPACE_VIDEO_ENABLED` 和 `VUE_APP_WORKSPACE_ASSISTANT_ENABLED` 控制，便于与不同设备版本同步。
