<template>
  <div class="vl-main">
    <vl-slide></vl-slide>
    <div class="right-area">
      <vl-header></vl-header>
      <div class="content-box">
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
  import { onMounted, onBeforeUnmount } from 'vue';
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
      onMounted(() => {
        stopSessionWatch = startSessionWatch(() => {
          localStorage.removeItem('loginToken');
          localStorage.removeItem('isFirst');
          router.replace({name: 'login'});
        });
      });
      onBeforeUnmount(() => stopSessionWatch?.());
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
  @media (max-width: 620px) {
    .content-box {
      padding: 10px;
    }
  }
</style>
