<template>
  <div class="vl-header flex-between">
    <div class="page-title">{{ pageTitle }}</div>
    <div class='headTxt cursor'>
      <el-avatar :size="35" :src="require('@/assets/img/peo.png')" class="userPhoto"></el-avatar>
      <button type="button" class="logout-btn" aria-label="退出登录" @click="gotoUrl">
        <svg-icon icon-class="logout" class="logout-icon" />
        <span class="logout-text">退出登录</span>
      </button>
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
        return '监控运维';
      }
      if (name === 'videoRecognition') {
        const map = { records: '检测记录', models: '模型管理', diagnostics: '视频诊断' };
        return view && map[view] ? `视频分析 · ${map[view]}` : '视频分析';
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
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .headTxt{
    padding-right: 24px;
    display: flex;
    align-items: center;
    flex-shrink: 0;
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
    padding: 6px 10px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    white-space: nowrap;
    cursor: pointer;
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
@media (max-width: 620px) {
  .vl-header {
    .page-title { padding: 0 12px; }
    .headTxt { padding-right: 8px; }
    .userPhoto { display: none; }
  }
}
</style>
