import { createStore } from 'vuex'

export default createStore({
  // 需要存储的值都放在这里面
  state(){
    return{
      userMenus:null,
      loginUser: null, // 登录用户信息
      routeAuth: [],
      permissions: [],
    }
  },
  mutations: {
      // 存储用户信息
      setLoginUser(state, options) {
        state.loginUser = options;
      },
      // 存储用户数据权限
      setPermissions(state, options) {
        state.permissions = options.permissions;
      },
      // 存储菜单列表
      setUserMenus(state, options) {
        state.userMenus = options.userMenus ;
      },
      // 用户路由权限配置
      setRouteAuth(state, options) {
        state.routeAuth = options.routeAuth
      },
  },
  modules: {
  }
})
