<template>
  <div class="loginMain">
   <div class="loginContent">
    <div class="loginCon">
      <!-- <p class="title">远程数据销毁管理</p> -->
      <p class="tit">使用本地管理账号登录</p>
      <el-form @keyup.enter="handleCurrentChange" ref="formRef" :model="form" :rules="rules"  label-width="0px"  @submit.prevent='handleCurrentChange'>
          <el-form-item label="" prop='user_name'>
            <el-input size='large' placeholder='请输入账号' :prefix-icon='User' v-model="form.user_name" clearable></el-input>
          </el-form-item>
          <el-form-item label="" prop='password'>
            <el-input size='large' placeholder='请输入密码' :prefix-icon='Lock' v-model="form.password"  show-password clearable></el-input>
          </el-form-item>
          <el-form-item>
            <!-- <el-input placeholder='请输入验证码' prefix-icon='el-icon-picture-outline' v-model="form.captchaCode" style="width:150px;display:inline-block;"></el-input>
            <img :src='src' class="imgs"> -->
          </el-form-item>
      </el-form>

      <el-button size='large' type="primary" native-type="button" @click="handleCurrentChange" style="width:100%;margin-top:25px;">登 录</el-button>
      <p class="note">初始账号和密码请联系销售人员，注意账号资料的保密，并经常修改密码</p>
      <p v-if="demoEnabled" class="note demo-note">演示账号 demo · 密码 Demo1234</p>
    </div>
    </div>
  </div>
</template>
<script setup>
import {
  User,
  Lock,
} from '@element-plus/icons-vue'
import { login } from "@/api/api.common";
import { demoEnabled } from '@/demo/data';

const form=reactive({
          user_name: demoEnabled ? 'demo' : '',
          password: demoEnabled ? 'Demo1234' : '',
        })
 const rules={
          user_name:[
            {required:true,message:'账号不能为空',trigger:'blur'}
          ],
          password:[
            {required:true,message:'密码不能为空',trigger:'blur'}
          ]
        }

const formRef=ref()
let submitting = false;
const DEFAULT_PASSWORD = 'Aa123456';
const handleCurrentChange=()=> {
  if (submitting) return;

   formRef.value.validate((valid)=>{
        if(valid){
            submitting = true;
            let params={
                 user_name:form.user_name,
                 password:rsaEncrypt(form.password)
            }
            login(params).then((res) => {
              const isDefaultPassword = form.password === DEFAULT_PASSWORD;
              localStorage.setItem('loginToken',res.data.token);
              localStorage.setItem('isFirst', String(isDefaultPassword &&
                localStorage.getItem('defaultPasswordPromptDisabled') !== 'true'));
              // 登录后重新请求HTML和当前资源，避免部署后仍运行旧标签页中的前端代码。
              window.history.replaceState(window.history.state, '', '#/home');
              window.location.reload();
            }).catch(() => {}).finally(() => { submitting = false; })
        }
   })

}

const rsaEncrypt = data => data;

</script>
<style lang="scss">
 .loginMain{
  width: 100%;
  height: 100%;
  background:url(../assets/img/bj.png) no-repeat center #E6EEF5;//, linear-gradient(#50a1f5 10%, #074d95 100%);//;
  display: flex;
  align-items: center;
  .title{
    font-size:26px;
    text-align: center;
    color:rgba(255,255,255,.9);
    font-weight: bold;
    position: absolute;
    margin-left: 55px;
    margin-top: -70px;
  }
  .loginContent{
    width:60%;
    margin:0px auto;
  }
  .loginCon{
    float:right;
    width:460px;
    height: 600px;
    padding:40px 38px;
    background:#fff;
    .tit{
      font-size: 24px;
      padding-bottom: 30px;
      font-weight: bold;
    }

    .note{
      color:rgba(0,0,0,.4);
      font-size: 12px;
      margin-top: 12px;
    }
  }
  input,button{
      line-height: 48px;
      height: 48px;
  }

 }

@media (max-width: 767px) {
  .loginMain {
    background-position: center;
    background-size: cover;
    overflow-y: auto;
    padding: 18px;
    .loginContent { width: min(100%, 460px); margin: auto; }
    .loginCon {
      float: none;
      width: 100%;
      height: auto;
      padding: 24px 20px;
      border-radius: 12px;
    }
    input { font-size: 16px; }
  }
  #app .loginMain .loginCon .tit { font-size: 21px; padding-bottom: 20px; }
}

</style>
