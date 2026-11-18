<template>
  <div class="vl-main">
    <!--头部-->
    <vl-header></vl-header>
    <!--内容区-->
    <div class="vl-content">
      <!--侧边-->
      <vl-slide></vl-slide>
      <!--内容-->
      <div class="content-box">
        <!-- <div class='contentBox'> -->
           <router-view></router-view>
        <!-- </div> -->
      </div>
    </div>
    <!--底部-->
   <up-pwd ref="pwdDialog" :show-never-remind="true" @close="handlePwdDialogClose" @never-remind="handleNeverRemind"></up-pwd>
  </div>
</template>
<script>
  import { storage } from '@/demo/storage';
  import { demoFetch } from '@/demo/data';
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
          storage.removeItem('loginToken');
          storage.removeItem('isFirst');
          router.replace({name: 'login'});
        }, {
          getToken: () => storage.getItem('loginToken'),
          request: demoFetch,
          isTokenChange: event => storage.isChange(event, 'loginToken')
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
  }
  .vl-content {
    background:#F2F4F5;
    height: calc(100% - 48px);
    display: flex;
    justify-content: space-between;
    .content-box {
      width:100%;
      padding:16px 24px;
      height: 100%;
      overflow: hidden;
      background:#F2F4F5;
      overflow-y: auto;
      // border: 16px solid #F5F5F5;
      // .contentBox{
        
      //   min-height:100%;
      // }
    }
  }
</style>
