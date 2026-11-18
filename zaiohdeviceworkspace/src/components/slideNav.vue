<template>
<div>
  <p class="collapse"  @click='isCollapse=!isCollapse'>
      
        <svg-icon icon-class='open'></svg-icon>
  </p>
  <el-menu  :collapse="isCollapse" :unique-opened='true'
    :default-active="$route.name"
     class="vl-slide">
    <template v-for="(item, index) in navList" :key='index'>
      <el-menu-item 
        
        :index="item.rName"
        @click="goToPage(item)"
       >
          <svg-icon :icon-class="item.meta.icon" />
          <template #title>{{item.label}}</template>
      </el-menu-item>
    </template>
    
  </el-menu>

 
  </div>
</template>
<script>
 
  export default {
    data() {
      return {
        navList: [
          {label: '首页', rName: 'home',meta:{icon:'home'}, children: []},
          {label: '监控运维', rName: 'monitoring',meta:{icon:'jkyw'}, children: []},
          {label: '视频识别', rName: 'videoRecognition',meta:{icon:'video'}, children: []},
          {label: '日志', rName: 'log',meta:{icon:'log'}, children: []},
          {label: '系统升级', rName: 'sysupdate',meta:{icon:'xtsj'}, children: []},
          {label: '修改密码', rName: 'password',meta:{icon:'xgmm'}, children: []},
          {label: '远程桌面', rName: 'remote',meta:{icon:'yczm'}, children: []},
        ],
        isCollapse:false,
      }
    },
    watch: {
      '$route.name': {
        immediate: true,
        handler(name) {
          if (name === 'videoRecognition' && window.matchMedia('(max-width: 620px)').matches) {
            this.isCollapse = true;
          }
        },
      },
    },
    methods: {

      goToPage(item) {
        this.$router.push({name: item.rName,params:{title:item.label}});
        
      },
    },
  }
</script>
<style lang="scss">
.el-menu{
      background:#fff;
      border-right: none;
      height: 100%;
}

  .vl-slide:not(.el-menu--collapse)  {
    padding-top: 10px;
    width: 220px;
    height:100%;
    background:#fff;
    color:#000;
    border-right-color:#F2F4F5;
    overflow: hidden;
    overflow-y: auto;
    font-size:16px;
    
     .el-menu-item,.el-sub-menu__title{
        line-height: 40px;
        height: 40px;
        font-size: 16px;
      }
    .el-menu--inline {
      padding:0px 0px 0px 45px;
      min-width: 179px;
      transition:0s;
      // line-height: 37px;
      // height: 37px;
      &.is-active {
        color:#007CF7;
        background: transparent;
      }
      &:hover {
        color:#007CF7;
        background: transparent;
      }
      .el-menu-item{
        padding:0px;
        color:rgba(0,0,0,.6);
        &.is-active {
          color:#007CF7;
          background: transparent;
        }
        &:hover {
          color:#007CF7;
          background: transparent;
        }
      }
    }
    .el-submenu__title{
      line-height: 37px;
      height: 37px;
      &.is-active {
        color:#007CF7;
        background: transparent;
      }
      &:hover{
        background: transparent;
      }
    }
    // .el-sub-menu__icon-arrow{
    //    background: url(../assets/img/down.png) ;
    //    background-size: 100%;
    //    width: 16px;
    //    height: 16px;
    //    color: #494949;
    // }
  }
  // .vl-slide.el-menu{
  //     background:transparent;
  // }
    .collapse{
      width:64px;
      position: fixed;
      left: 0px;
      top:0px;
      padding:7px 0px;
      text-align: center;
      background: #E5E8EB;
      cursor: pointer;
      // border-right: 1px solid #ebebeb;
      .svg-icon{
         width: 30px;
         height: 30px;
      }
    }
    .el-menu-item .el-menu-tooltip__trigger{
      padding: 0px;
      display: flex;
      justify-content: center;
    }
</style>
