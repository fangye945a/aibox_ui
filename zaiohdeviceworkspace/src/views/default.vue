<template>
  <div class="vl-main">
    <!--左侧全高导航-->
    <vl-slide></vl-slide>
    <!--右侧区域-->
    <div class="right-area">
      <!--头部-->
      <vl-header></vl-header>
      <!--内容-->
      <div class="content-box">
        <router-view></router-view>
      </div>
    </div>
    <!--底部-->
   <up-pwd ref="pwdDialog" :show-never-remind="true" @close="handlePwdDialogClose" @never-remind="handleNeverRemind"></up-pwd>
  </div>
</template>
<script>
  import { storage } from '@/demo/storage';
  import { demoFetch } from '@/demo/data';
  import { onMounted, onBeforeUnmount, provide } from 'vue';
  import { CreateVideoWorkspace, RunVideoWorkspace, VIDEO_WORKSPACE } from '@/demo/video-workspace';
  import { CreateSystemMonitor, RunSystemMonitor, SYSTEM_MONITOR } from '@/demo/system-monitor';
  import { useRouter } from 'vue-router';
  import { startSessionWatch } from '@/utils/session-watch';
  import vlHeader from '@/components/header.vue';
  import vlSlide from '@/components/slideNav.vue';
  import upPwd from './upPwd.vue'
  export default {
    components: { vlHeader, vlSlide ,upPwd},
    setup() {
      const router = useRouter();
      let stopSessionWatch = null;
      let stopVideoWorkspace = null;
      let stopSystemMonitor = null;
      const videoWorkspace = CreateVideoWorkspace();
      const systemMonitor = CreateSystemMonitor();
      provide(VIDEO_WORKSPACE, videoWorkspace);
      provide(SYSTEM_MONITOR, systemMonitor);
      onMounted(() => {
        stopVideoWorkspace = RunVideoWorkspace(videoWorkspace);
        stopSystemMonitor = RunSystemMonitor(systemMonitor);
        stopSessionWatch = startSessionWatch(() => {
          storage.removeItem('loginToken');
          storage.removeItem('isFirst');
          router.replace({name: 'login'});
        }, {
          getToken: () => storage.getItem('loginToken'),
          request: demoFetch,
          isTokenChange: event => storage.isChange(event, 'loginToken')
        });
      });
      onBeforeUnmount(() => {
        stopSessionWatch?.();
        stopVideoWorkspace?.();
        stopSystemMonitor?.();
      });
    },
    data() {
      return {
        isFirst:true
      }
    },
    mounted() {
    const isFirst = storage.getItem('isFirst');
    const promptDisabled = storage.getItem('defaultPasswordPromptDisabled') === 'true';
    if (!promptDisabled && isFirst === 'true') {
      this.$refs.pwdDialog.dialogVisible = true;
    }
    },
    methods: {
      handlePwdDialogClose() {
        // 取消只关闭弹框，下次使用默认密码登录仍然提醒。
      },
      handleNeverRemind() {
        storage.setItem('isFirst', 'false');
      }
    }

  }
</script>
<style lang="scss" scoped>
  .vl-main {
    width: 100%;
    height: 100%;
    color: #2B3F5C;
    font-size: .16rem;
    display: flex;
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
  @media (max-width: 620px) {
    .content-box {
      padding: 10px;
    }
  }
</style>
