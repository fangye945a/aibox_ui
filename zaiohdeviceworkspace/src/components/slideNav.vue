<template>
  <aside class="side-shell" :class="{ collapsed: isCollapse, 'side-drawer': mobile }">
    <button type="button" class="side-logo" aria-label="返回首页" @click="goHome">
      <img class="logo-img" src="../assets/img/system-logo.png" alt="在鸿">
      <span class="logo-title">边缘本地控制台</span>
    </button>
    <el-scrollbar class="side-scroll">
      <el-menu
        ref="menu"
        :default-active="activeIndex"
        :collapse="isCollapse"
        :collapse-transition="false"
        :close-on-click-outside="isCollapse"
        :unique-opened="true"
        background-color="#304155"
        text-color="#BFCBD9"
        active-text-color="#FFFFFF"
        class="side-menu"
        @select="handleSelect"
      >
        <template v-for="item in navList" :key="item.key">
          <el-sub-menu v-if="item.children" :index="item.key" :aria-label="item.label"
            popper-class="side-video-popup">
            <template #title>
              <svg-icon :icon-class="item.icon" />
              <span>{{ item.label }}</span>
            </template>
            <el-menu-item v-for="child in item.children" :key="child.id" :index="'videoRecognition:' + child.id"
              :aria-current="activeIndex === 'videoRecognition:' + child.id ? 'page' : undefined">
              {{ child.label }}
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item v-else :index="item.key">
            <svg-icon :icon-class="item.icon" />
            <template #title>{{ item.label }}</template>
          </el-menu-item>
        </template>
      </el-menu>
    </el-scrollbar>
    <button v-if="!mobile" type="button" class="side-toggle" @click="isCollapse = !isCollapse"
      :aria-label="isCollapse ? '展开菜单' : '收起菜单'" :aria-expanded="!isCollapse">
      <svg-icon :icon-class="'open'" :class="['toggle-icon', { rotated: isCollapse }]" />
      <span v-if="!isCollapse" class="toggle-text">收起菜单</span>
    </button>
  </aside>
</template>
<script>
import { videoView, videoViews } from '@/router/videoViews';

const videoEnabled = process.env.VUE_APP_WORKSPACE_VIDEO_ENABLED === 'true';
const assistantEnabled = process.env.VUE_APP_WORKSPACE_ASSISTANT_ENABLED === 'true';

export default {
  name: 'VlSlide',
  props: { mobile: Boolean },
  emits: ['navigate'],
  data() {
    return {
      navList: [
        {key: 'home', label: '首页', icon: 'home'},
        {key: 'monitoring', label: '监控运维', icon: 'jkyw'},
        ...(assistantEnabled ? [
          {key: 'assistant', label: '智能问答', icon: 'jkyw'}
        ] : []),
        ...(videoEnabled ? [
          {key: 'videoRecognition', label: '视频分析', icon: 'video', children: videoViews}
        ] : []),
        {key: 'log', label: '日志', icon: 'log'},
        {key: 'sysupdate', label: '系统升级', icon: 'xtsj'},
        {key: 'password', label: '修改密码', icon: 'xgmm'},
        {key: 'remote', label: '远程桌面', icon: 'yczm'}
      ],
      isCollapse: false
    };
  },
  computed: {
    activeIndex() {
      return this.$route.name === 'videoRecognition'
        ? 'videoRecognition:' + videoView(this.$route.query.view).id
        : this.$route.name;
    }
  },
  watch: {
    '$route.name': 'openCurrentSection',
    isCollapse: 'openCurrentSection'
  },
  mounted() {
    this.openCurrentSection();
  },
  methods: {
    goHome() {
      this.$router.push({name: 'home'});
      this.$emit('navigate');
    },
    openCurrentSection() {
      if (this.$route.name === 'videoRecognition' && !this.isCollapse) {
        this.$nextTick(() => this.$refs.menu?.open('videoRecognition'));
      }
    },
    handleSelect(key) {
      const [name, view] = key.split(':');
      this.$router.push({name, query: view && view !== 'live' ? {view} : {}});
      this.$emit('navigate');
    }
  }
};
</script>
<style lang="scss">
  $side-bg: #304155;
  $side-bg-active: #1D2D3C;
  $side-text: #BFCBD9;
  $side-text-active: #FFFFFF;

  .side-shell {
    width: 220px;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: $side-bg;
    transition: width 0.2s;
    flex-shrink: 0;
    position: relative;
    z-index: 5;

    &.collapsed {
      width: 64px;
      .side-logo {
        padding: 12px 0 10px;
        gap: 8px;
        .logo-img { width: 32px; height: auto; }
        .logo-title { display: none; }
      }
      .side-toggle { justify-content: center; padding: 0; }
      .toggle-text { display: none; }
    }
  }

  .side-logo {
    width: 100%;
    border: 0;
    background: transparent;
    font-family: inherit;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 24px 12px 20px;
    cursor: pointer;
    overflow: hidden;
    flex-shrink: 0;
    .logo-img {
      width: 108px;
      height: auto;
      object-fit: contain;
      display: block;
    }
    .logo-title {
      font-size: 15px;
      font-weight: 600;
      color: #fff;
      white-space: nowrap;
      letter-spacing: 2px;
      line-height: 1;
    }
  }

  .side-scroll {
    flex: 1;
    min-height: 0;
    .el-scrollbar__wrap {
      overflow-x: hidden;
    }
    .el-menu {
      border-right: none;
      width: 100%;
    }
  }

  .side-menu:not(.el-menu--collapse) {
    width: 220px;
  }

  /* 一级菜单项 */
  .side-shell .el-menu-item,
  .side-shell .el-sub-menu__title {
    height: 52px;
    line-height: 52px;
    font-size: 15px;
    color: $side-text;
    &:hover {
      background: $side-bg-active;
      color: $side-text-active;
    }
  }

  /* 激活的一级菜单 */
  .side-shell .el-menu-item.is-active {
    background: $side-bg-active !important;
    color: $side-text-active !important;
  }

  .side-shell .el-sub-menu__title {
    gap: 8px;
  }

  .side-shell .el-menu--inline {
    background: #28394b;

    .el-menu-item {
      height: 42px;
      line-height: 42px;
      font-size: 14px;
      min-width: 0;
      padding-inline-start: 48px;
    }

    .el-menu-item.is-active {
      box-shadow: inset 3px 0 #59abff;
      color: #a0d0ff !important;
    }
  }

  .side-video-popup .el-menu-item.is-active {
    background: $side-bg-active;
  }

  .side-toggle {
    width: 100%;
    min-height: 42px;
    border: 0;
    background: transparent;
    font-family: inherit;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    cursor: pointer;
    color: #6b7d94;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
    &:hover {
      color: #fff;
      background: $side-bg-active;
    }
    .toggle-icon {
      width: 16px;
      height: 16px;
      margin: 0;
      transition: transform 0.2s;
      &.rotated {
        transform: rotate(180deg);
      }
    }
    .toggle-text {
      font-size: 12px;
      white-space: nowrap;
    }
  }

  @media (max-width: 767px) {
    .side-shell.side-drawer { width: 100%; }
    .side-drawer .side-logo { padding: 12px 12px 18px; }
    .side-drawer .side-menu:not(.el-menu--collapse) { width: 100%; }
    .side-drawer .el-menu-item, .side-drawer .el-sub-menu__title { min-height: 44px; line-height: 44px; }
  }
</style>
