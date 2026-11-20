import { createRouter, createWebHashHistory } from 'vue-router'
import store from '@/store/';
import { demoFetch } from '@/demo/data';
import { storage } from '@/demo/storage';

const routes = [
    // {
    //   path: '*',
    //   name: 'not_found',
    //   component: () => import('@/components/notFound.vue'),
    //   meta: {
    //     unRequireLogin: true,
    //   }
    // }, // 404
    {
      path: '/',
      name: 'index',
      component: () => import('@/views/default.vue'),
      meta: {
        title: '边缘本地控制台',
        unRequireLogin: false
      },
      redirect: {
        name: 'home'
      },
      children: [
        {
          path: '/home',
          name: 'home',
          component: () => import('@/views/home.vue'),
          meta: {
            title: '首页',
            unRequireLogin: false,
          }
        },
        //监控运维
        {
          path: '/monitoring',
          name: 'monitoring',
          component: () => import('@/views/monitoring.vue'),
          meta: {
            title: '监控运维',
            unRequireLogin: false,
          }
        },
        {
          path: '/video-recognition',
          name: 'videoRecognition',
          component: () => import('@/views/videoRecognition.vue'),
          meta: { title: '视频分析', unRequireLogin: false }
        },
        //日志
        {
          path: '/log',
          name: 'log',
          component: () => import('@/views/log.vue'),
          meta: {
            title: '日志',
            unRequireLogin: false,
          }
        },
        //系统升级
        {
          path: '/sysupdate',
          name: 'sysupdate',
          component: () => import('@/views/sysupdate.vue'),
          meta: {
            title: '系统升级',
            unRequireLogin: false,
          }
        },
        //远程操控
        {
          path: '/remote',
          name: 'remote',
          component: () => import('@/views/remote.vue'),
          meta: {
            title: '远程操控',
            unRequireLogin: false,
          }
        },
        //修改密码
        {
          path: '/password',
          name: 'password',
          component: () => import('@/views/password.vue'),
          meta: {
            title: '修改密码',
            unRequireLogin: false,
          }
        },
      ]
    },
    {
      path: '/route',
      name: 'routePage',
      component: () => import('@/components/routePage.vue'),
      meta: {
        title: '加载中...',
        unRequireLogin: true
      }
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/login'),
      meta: {
        title: '边缘本地控制台',
        unRequireLogin: true
      },
    },
  ]


const router = createRouter({
  history: createWebHashHistory(process.env.BASE_URL),
  routes
})
const clearSession = () => {
  storage.removeItem('loginToken');
  storage.removeItem('isFirst');
};

let sessionValidation = null;

const isSessionValid = async () => {
  const token = storage.getItem('loginToken');
  if (!token) {
    return false;
  }
  if (!sessionValidation) {
    sessionValidation = demoFetch('/api/auth/status', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    }).then(async response => {
      if (!response.ok) {
        return false;
      }
      const data = await response.json();
      return data?.isLoggedIn === true;
    }).catch(() => false).finally(() => {
      sessionValidation = null;
    });
  }
  return sessionValidation;
};

router.beforeEach(async (to, from, next) => {
  document.title ='边缘本地控制台';// to.meta.title;
  let tokens= storage.getItem('loginToken')
  // 无需鉴权跟已登录直接放行
  let unRequireLogin = to.meta && to.meta.unRequireLogin;
  if (unRequireLogin) {
    // 不需要登陆，直接走
    next();
    return;
  }
  if (tokens && to.fullPath === from.fullPath) {
    next();
    return;
  }
  if (tokens && await isSessionValid()) {
    next();
    return;
  }
  if (tokens) {
    clearSession();
  }
  next({name: 'login'});
})

router.onError(() => {
  // window.location.reload();
});
export default router;
