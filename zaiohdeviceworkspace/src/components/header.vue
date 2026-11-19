<template>
  <div class="vl-header flex-between">
    <div class="page-title">{{ pageTitle }}</div>
    <div class='headTxt cursor'>
      <el-avatar :size="35" :src="require('@/assets/img/peo.png')" class="userPhoto"></el-avatar>|
      <span class="logout-btn" role="button" tabindex="0" @click="gotoUrl">
        <svg-icon icon-class="logout" class="logout-icon" />
        <span class="logout-text">退出登录</span>
      </span>
    </div>
  </div>
</template>
<script>
export default {
  computed: {
    pageTitle() {
      const name = this.$route.name;
      const view = this.$route.query.view;
      if (name === 'monitoring') {
        return view === 'video' ? '监控运维 · 视频诊断' : '监控运维 · 整机状态';
      }
      if (name === 'videoRecognition') {
        const map = { records: '检测记录', settings: '通道配置', models: '模型管理' };
        return view && map[view] ? `视频分析 · ${map[view]}` : '视频分析 · 实时检测';
      }
      const titles = {
        home: '首页',
        log: '日志',
        sysupdate: '系统升级',
        password: '修改密码',
        remote: '远程桌面',
      };
      return titles[name] || '边缘本地控制台';
    },
  },
  data () {
    return {
      isUpdate:false,
    }
  },
  methods: {
     gotoUrl(){
       this.$router.push({name: 'routePage', query: {pageType: 'DO_LOGOUT'}})
     }
  }
}
</script>
<style lang="scss">
.vl-header {
  height: 48px;
  background: #fff;
  color: #1D2129;
  flex-shrink: 0;
  border-bottom: 1px solid #EBEEF2;
  .page-title {
    padding: 0 24px;
    font-size: 14px;
    font-weight: 600;
    color: #1D2129;
    white-space: nowrap;
  }
  .headTxt{
    padding-right: 24px;
    display: flex;
    align-items: center;
    color: rgba(0,0,0,.45);
    cursor: pointer;
  }
  .userPhoto{
    vertical-align: middle;
    margin-right: 12px;
  }
  .logout-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: 14px;
    padding: 6px 10px;
    border-radius: 6px;
    color: #1D2129;
    transition: background-color 0.2s, color 0.2s;
    &:hover {
      background: #F2F4F5;
      color: #007CF7;
      .logout-icon { color: #007CF7; }
    }
  }
  .logout-icon {
    width: 16px;
    height: 16px;
    color: rgba(0, 0, 0, 0.55);
  }
  .logout-text {
    font-size: 13px;
    line-height: 1;
  }
}
</style>
