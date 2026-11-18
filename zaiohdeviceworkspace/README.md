# 设备本地控制台前端

Vue 3、Vue Router、Vuex、Element Plus、ECharts 与 Webpack 实现。布局、样式、图标和图片资源沿用设备本地控制台原设计，包含首页、监控运维、日志、系统升级、修改密码、远程桌面。

所有业务请求使用当前来源，JSON接口采用数值code/data/msg，文件下载按Blob处理，实时数据使用带Bearer鉴权的SSE。前端只保存登录令牌，不保存密码。登录/密码表单直连Go账号接口；后台默认账户策略和能力边界见仓库README。

`src/api/`保存接口，`src/config/axios.js`处理鉴权和错误，`src/views/`保存页面，`src/components/`保存公用组件，`src/assets/`和`public/`保存本地资源。开发代理可设置VUE_APP_BASE_URL，生产环境不依赖固定设备IP。

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm run lint
npm run build
```

兼容构建入口的typecheck命令执行Vue SFC/JavaScript解析与模板编译检查；本前端不含TypeScript业务源码。生产静态产物位于dist，由Go服务提供；无需Node运行时或Docker运行前端。
