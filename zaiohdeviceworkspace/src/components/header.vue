<template>
  <div class="vl-header flex-between">
    <div class='top'>
       <div class="logo"><img src='@/assets/img/logo.png'>边缘本地控制台</div>
       
    </div>
    <div class='headTxt cursor'>
      <el-avatar :size="35" :src="require('@/assets/img/peo.png')" class="userPhoto"></el-avatar>|
      <svg-icon icon-class="logout" @click='gotoUrl' style="width:24px;height:24px;margin-left:12px;" />
    </div>

   
  </div>
</template>
<script>
export default {
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
  color: #373737;
  .top{
    .logo{
        padding:0 20px 0px 76px;
        margin-right: 20px;
        font-weight: 600;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 20px;
        img{
          vertical-align: middle;
          margin-right: 6px;
          height:28px;
        }
      }
    .tit{
      color:rgba(0,0,0,0.85);
      font-size: 14px;
      font-weight: 550;
      cursor: pointer;
    }
  }
  .headTxt{
    padding-right: 24px;
    display: flex;
    align-items: center;
    color:rgba(0,0,0,.2);
    cursor: pointer;
  }
  .userPhoto{
    vertical-align: middle;
    margin-right: 12px;
  }

  

}
// .dropMenu{
//   width:140px;
// }
</style>


