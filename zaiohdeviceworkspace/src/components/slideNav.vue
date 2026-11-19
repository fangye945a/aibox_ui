<template>
  <aside class="side-shell" :class="{ collapsed: isCollapse }">
    <div class="side-logo" @click="goHome">
      <img class="logo-img" src="../assets/img/system-logo.png" alt="在鸿">
      <span class="logo-title">边缘本地控制台</span>
    </div>
    <el-scrollbar class="side-scroll">
      <el-menu
        ref="menu"
        :default-active="activeIndex"
        :default-openeds="defaultOpeneds"
        :collapse="isCollapse"
        :collapse-transition="false"
        :unique-opened="true"
        background-color="#304155"
        text-color="#BFCBD9"
        active-text-color="#FFFFFF"
        class="side-menu"
        @select="handleSelect"
      >
        <template v-for="item in navList" :key="item.key">
          <!-- 含二级菜单 -->
          <el-sub-menu v-if="item.children && item.children.length" :index="item.key">
            <template #title>
              <svg-icon :icon-class="item.icon" />
              <span>{{ item.label }}</span>
            </template>
            <el-menu-item v-for="child in item.children" :key="child.key" :index="child.key">
              {{ child.label }}
            </el-menu-item>
          </el-sub-menu>
          <!-- 普通一级菜单 -->
          <el-menu-item v-else :index="item.key">
            <svg-icon :icon-class="item.icon" />
            <template #title>{{ item.label }}</template>
          </el-menu-item>
        </template>
      </el-menu>
    </el-scrollbar>
    <div class="side-toggle" @click="isCollapse = !isCollapse" :title="isCollapse ? '展开' : '收起'">
      <svg-icon :icon-class="'open'" :class="['toggle-icon', { rotated: isCollapse }]" />
      <span v-if="!isCollapse" class="toggle-text">收起菜单</span>
    </div>
  </aside>
</template>
<script>
  import { mapGetters } from 'vuex';

  const PAGES_DEMO = process.env.VUE_APP_PAGES_DEMO === 'true';

  export default {
    name: 'VlSlide',
    data() {
      return {
        navList: [
          { key: 'home', label: '首页', icon: 'home', rName: 'home' },
          {
            key: 'monitoring',
            label: '监控运维',
            icon: 'jkyw',
            children: [
              { key: 'monitoring:device', label: '整机状态', rName: 'monitoring', query: { view: 'device' } },
              { key: 'monitoring:video', label: '视频诊断', rName: 'monitoring', query: { view: 'video' } },
            ],
          },
          {
            key: 'videoRecognition',
            label: '视频分析',
            icon: 'video',
            children: [
              { key: 'videoRecognition:live', label: '实时检测', rName: 'videoRecognition', query: {} },
              { key: 'videoRecognition:records', label: '检测记录', rName: 'videoRecognition', query: { view: 'records' } },
              { key: 'videoRecognition:settings', label: '通道配置', rName: 'videoRecognition', query: { view: 'settings' } },
              { key: 'videoRecognition:models', label: '模型管理', rName: 'videoRecognition', query: { view: 'models' } },
            ],
          },
          { key: 'log', label: '日志', icon: 'log', rName: 'log' },
          { system: true, key: 'sysupdate', label: '系统升级', icon: 'xtsj', rName: 'sysupdate' },
          { key: 'password', label: '修改密码', icon: 'xgmm', rName: 'password' },
          { key: 'remote', label: '远程桌面', icon: 'yczm', rName: 'remote' },
        ].filter(item => !PAGES_DEMO || item.rName !== 'home'),
        isCollapse: false,
      };
    },
    computed: {
      ...mapGetters({}),
      activeIndex() {
        const name = this.$route.name;
        const view = this.$route.query.view;
        if (name === 'monitoring') {
          return view === 'video' ? 'monitoring:video' : 'monitoring:device';
        }
        if (name === 'videoRecognition') {
          const key = ['records', 'settings', 'models'].includes(view) ? view : 'live';
          return `videoRecognition:${key}`;
        }
        return name;
      },
      defaultOpeneds() {
        const name = this.$route.name;
        return ['monitoring', 'videoRecognition'].includes(name) ? [name] : [];
      },
    },
    watch: {
      '$route.name': {
        immediate: true,
        handler(name) {
          if (['videoRecognition', 'monitoring'].includes(name) && window.matchMedia('(max-width: 620px)').matches) {
            this.isCollapse = true;
          }
          // 路由切换时自动展开当前模块的父菜单
          this.$nextTick(() => {
            if (['monitoring', 'videoRecognition'].includes(name) && !this.isCollapse && this.$refs.menu) {
              this.$refs.menu.open(name);
            }
          });
        },
      },
    },
    methods: {
      goHome() {
        if (!PAGES_DEMO) {
          this.$router.push({ name: 'home' });
        }
      },
      handleSelect(key) {
        const flat = this.navList.flatMap(item => item.children ? item.children : [item]);
        const target = flat.find(entry => entry.key === key);
        if (!target) return;
        if (['videoRecognition', 'monitoring'].includes(target.rName) && window.matchMedia('(max-width: 620px)').matches) {
          this.isCollapse = true;
        }
        const query = { ...(target.query || {}) };
        // 保留通道参数（视频诊断/检测记录等场景跳转会带上 channel）
        if (this.$route.query.channel && target.rName === this.$route.name) {
          query.channel = this.$route.query.channel;
        }
        this.$router.push({ name: target.rName, query });
      },
    },
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
    ::v-deep .el-scrollbar__wrap {
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

  /* 子菜单展开区 */
  .side-shell .el-menu--inline {
    background: rgba(0, 0, 0, 0.15) !important;
    .el-menu-item {
      height: 46px;
      line-height: 46px;
      font-size: 14px;
      color: rgba(191, 203, 217, 0.85);
      min-width: 0;
      padding: 0 24px 0 48px !important;
      &:hover {
        background: transparent;
        color: #fff;
      }
      &.is-active {
        background: transparent;
        color: #4EA1F3 !important;
        position: relative;
        &::before {
          content: '';
          position: absolute;
          left: 32px;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 14px;
          border-radius: 2px;
          background: #4EA1F3;
        }
      }
    }
  }

  /* 展开箭头 */
  .side-shell .el-sub-menu__icon-arrow {
    color: $side-text;
  }

  /* 折叠态弹出的二级菜单 */
  .el-menu--vertical .el-menu-item {
    height: 40px;
    line-height: 40px;
  }

  .side-toggle {
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

  @media (max-width: 620px) {
    .side-shell {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      box-shadow: 3px 0 10px rgb(16 30 46 / 30%);
    }
    .side-shell.collapsed {
      position: relative;
      box-shadow: none;
    }
  }
</style>
