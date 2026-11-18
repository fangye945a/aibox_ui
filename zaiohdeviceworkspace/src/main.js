import { createApp } from 'vue'
import App from './App.vue'
import router from "./router";
import store from "@/store";

import ElementPlus from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import 'element-plus/dist/index.css'

// 虚拟滚动
import VueVirtualScroller from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'


// pc适配rem方案
import "@/utils/flexible.js"; 


//引入svg组件
import IconSvg from './components/iconSvg'
//全局注册svg-icon

const app=createApp(App)
app.use(ElementPlus, {
    locale: zhCn,
  })
.use(VueVirtualScroller)


//全局注册svg-icon
app.component('svg-icon', IconSvg);
app.use(store)
.use(router)
.mount('#app')