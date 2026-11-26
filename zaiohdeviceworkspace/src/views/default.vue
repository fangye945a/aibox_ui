<template>
  <div class="vl-main">
    <vl-slide v-if="!compact" />
    <el-drawer v-else v-model="navigationOpen" direction="ltr" size="min(280px, calc(100vw - 48px))"
      title="工作台导航" append-to-body class="mobile-navigation">
      <vl-slide mobile @navigate="navigationOpen = false" />
    </el-drawer>
    <div class="right-area">
      <vl-header :compact="compact" :navigation-open="navigationOpen" @open-navigation="navigationOpen = true" />
      <div ref="content" class="content-box">
        <router-view v-slot="{ Component }">
          <keep-alive include="DeviceAssistant">
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </div>
    </div>
    <!--底部-->
   <up-pwd ref="pwdDialog" :show-never-remind="true" @close="handlePwdDialogClose" @never-remind="handleNeverRemind"></up-pwd>
  </div>
</template>
<script>
  import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import { startSessionWatch } from '@/utils/session-watch';
  import vlHeader from '@/components/header.vue';
  import vlSlide from '@/components/slideNav.vue';
  import upPwd from './upPwd.vue'
  export default {
    components: { vlHeader, vlSlide ,upPwd},
    setup() {
      const router = useRouter();
      const narrowScreen = window.matchMedia('(max-width: 767px)');
      const compact = ref(narrowScreen.matches);
      const navigationOpen = ref(false);
      const content = ref(null);

      function UpdateLayout() {
        compact.value = narrowScreen.matches;
        navigationOpen.value = false;
      }

      watch(() => router.currentRoute.value.fullPath, () => {
        if (compact.value && content.value) {
          content.value.scrollTop = 0;
        }
        navigationOpen.value = false;
      });
      let stopSessionWatch = null;
      onMounted(() => {
        if (narrowScreen.addEventListener) {
          narrowScreen.addEventListener('change', UpdateLayout);
        } else {
          narrowScreen.addListener(UpdateLayout);
        }
        stopSessionWatch = startSessionWatch(() => {
          localStorage.removeItem('loginToken');
          localStorage.removeItem('isFirst');
          router.replace({name: 'login'});
        });
      });
      onBeforeUnmount(() => {
        if (narrowScreen.removeEventListener) {
          narrowScreen.removeEventListener('change', UpdateLayout);
        } else {
          narrowScreen.removeListener(UpdateLayout);
        }
        stopSessionWatch?.();
      });
      return { compact, navigationOpen, content };
    },
    data() {
      return {
        isFirst:true
      }
    },
    mounted() {
    const isFirst = localStorage.getItem('isFirst');
    const promptDisabled = localStorage.getItem('defaultPasswordPromptDisabled') === 'true';
    if (!promptDisabled && isFirst === 'true') {
      this.$refs.pwdDialog.dialogVisible = true;
    }
    },
    methods: {
      handlePwdDialogClose() {
        // 取消只关闭弹框，下次使用默认密码登录仍然提醒。
      },
      handleNeverRemind() {
        localStorage.setItem('isFirst', 'false');
      }
    }

  }
</script>
<style lang="scss" scoped>
  .vl-main {
    width: 100%;
    height: 100%;
    color: var(--workspace-text);
    font-size: 14px;
    display: flex;
    position: relative;
    overflow: hidden;
  }
  .right-area {
    flex: 1;
    min-width: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .content-box {
    flex: 1;
    min-height: 0;
    padding: 16px 24px;
    overflow-y: auto;
    background: #F2F4F5;
  }
  @media (max-width: 767px) {
    .content-box {
      padding: 10px 12px max(12px, env(safe-area-inset-bottom));
      scroll-padding-bottom: 16px;
    }
  }
</style>

<style>
@media (max-width: 767px) {
  .mobile-navigation.el-drawer { background: #304155; color: #fff; }
  .mobile-navigation .el-drawer__header { margin-bottom: 0; padding: 12px 16px 0; color: #fff; }
  .mobile-navigation .el-drawer__close-btn { color: #fff; width: 44px; height: 44px; margin-inline-end: -8px; }
  .mobile-navigation .el-drawer__body { padding: 0; overflow: hidden; }
}
</style>
