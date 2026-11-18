<template>
  <div class="router">
    <div class="item item3">
      <div class="line"></div>
      <div class="line"></div>
      <div class="line"></div>
    </div>
  </div>
</template>

<script>
import { storage } from '@/demo/storage';
  import { logout } from "@/api/api.common";
export default {
  name: "routePage",
  data() {
    return {
      pageType: '',
      redirectUrl: '',
      loginToken: '',
      query: {},
      routeAuth: []
    }
  },
  mounted() {
    this.redirectUrl = this.$route.query.redirect||'home';
    this.loginToken =  storage.getItem('loginToken');

    // 清除url传参 因为走登录是用的url，但又不能丢失参数，跳路由用的query
  //   let url = window.location.href.split('?')[0] + '?';
  //   for (let key in this.$route.query) {
  //     if (['code','state', 'pageType'].includes(key)) continue;
  //  //   url += `${key}=${this.$route.query[key]}&`;
  //     if (key != 'redirect') {
  //       this.query[key] = this.$route.query[key];
  //     }
  //   }
  //   if (url.endsWith('&') || url.endsWith('?')) url = url.slice(0, -1);
  //   window.history.pushState({}, 0, url);
    this.todoInit();
  },
  methods: {
    todoInit() {
      this.type =  this.$route.query.pageType|| 'CHECK_LOGIN';
       
      switch (this.type) {
       
        case 'NO_AUTH':// 无权限访问当前接口
          this.noAuthHandle();
        break;
        case 'TOKEN_EXPIRE':// TOKEN失效
          this.tokenExpireHandle();
        break;
        case 'DO_LOGIN':// 登录
          this.toDoLogin();
        break;
        case 'DO_LOGOUT':// 登出
          this.toDoLogout();
        break;
        case 'CHECK_LOGIN':// 检查登录状态
          this.checkLogin();
        break;
      }
    },
    // 检查登录
    checkLogin() {
      if (this.loginToken) {
        this.$router.push({name: this.redirectUrl});
      } else {
        this.toDoLogin();
        
      }
    },
    // 无权限
    noAuthHandle() {
      this.$router.push({name: 'noAuth'});
    },
    // token过期
    tokenExpireHandle() {
     //clearCookie();
      this.toDoLogout();
    },
    // 登录
    toDoLogin() {
      this.$router.push({name:'login'});

    },
    // 登出
    async toDoLogout() { 
      try { await logout(); } catch { /* 会话失效也清理本地登录状态。 */ }
      this.toDoLogin();
      storage.removeItem('loginToken');
      storage.removeItem('isFirst');
      
    
    }
  },
  watch:{
    $route(to){
      if(to.query){
        this.todoInit();
      }
    }
  }
};
</script>
<style lang="scss" scoped>
//$color: #db395c;
$color: #a8a8a8;
$background-color: #f0efef;
body {
  position: relative;
  height: 100%;
  width: 100%;
}

.router {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100vw;
  height: 100vh;
  background-color: $background-color;
}

.item {
  display: block;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background-color: $color;
  position: relative;
  box-sizing: border-box;
  &.item3 {
    background-color: transparent;
    .line {
      width: 30%;
      height: 30%;
      border-radius: 5px;
      background-color: $color;
      position: absolute;
      bottom: 50%;
      top: 50%;
      transform: translateY(-50%);
    }
    .line:first-child {
      animation: height1 0.9s ease-in infinite;
      left: 0;
    }
    .line:nth-child(2) {
      animation: height2 0.9s ease-in infinite;
      left: 35%;
    }
    .line:last-child {
      animation: height3 0.9s ease-out infinite;
      right: 0;
    }
  }
}
@keyframes height1 {
  0% {
    height: 30%;
  }
  50% {
    height: 50%;
  }
  100% {
    height: 30%;
  }
}
@keyframes height2 {
  0% {
    height: 50%;
  }
  50% {
    height: 30%;
  }
  100% {
    height: 50%;
  }
}
@keyframes height3 {
  0% {
    height: 20%;
  }
  50% {
    height: 70%;
  }
  100% {
    height: 20%;
  }
}

.item1 {
  display: none;
}
</style>
