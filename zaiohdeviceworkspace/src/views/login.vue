<template>
  <div class="loginMain">
    <div class="loginContent">
    <!-- 右侧登录卡片 -->
    <div class="loginCon">
      <p class="tit">边缘本地控制台</p>
      <el-form @keyup.enter="handleCurrentChange" ref="formRef" :model="form" :rules="rules"  label-width="0px"  @submit.prevent='handleCurrentChange'>
          <el-form-item label="" prop='user_name'>
            <el-input size='large' placeholder='请输入账号' :prefix-icon='User' v-model="form.user_name" clearable></el-input>
          </el-form-item>
          <el-form-item label="" prop='password'>
            <el-input size='large' placeholder='请输入密码' :prefix-icon='Lock' v-model="form.password"  show-password clearable></el-input>
          </el-form-item>
      </el-form>
      
      <el-button class="login-btn" size='large' type="primary" native-type="button" @click="handleCurrentChange" style="width:100%;margin-top:25px;">登 录</el-button>
      <p class="note">演示账号：demo，初始密码：Demo1234</p>
      <el-button class="restore-btn" type="primary" link size="small" @click="restorePassword">恢复初始演示密码</el-button>
    </div>
    </div>
  </div>
</template>
<script setup>
import { storage } from '@/demo/storage';
import { resetDemoPassword } from '@/demo/data';
import { ElMessage } from 'element-plus';
import {
  User,
  Lock,
} from '@element-plus/icons-vue'
import { login } from "@/api/api.common";
import { useRouter } from 'vue-router';

const router = useRouter();

const form=reactive({
          user_name:'',
          password:'',
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
function restorePassword() {
  resetDemoPassword();
  form.user_name = 'demo';
  form.password = '';
  formRef.value?.clearValidate();
  ElMessage.success('已恢复初始演示密码');
}
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
              storage.setItem('loginToken',res.data.token);
              storage.setItem('isFirst', 'false');
              // 登录后重新请求HTML和当前资源，避免部署后仍运行旧标签页中的前端代码。
              window.history.replaceState(window.history.state, '', router.resolve({ name: 'home' }).href);
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
  background:url(../assets/img/bj.png) no-repeat center #E6EEF5;
  display: flex;
  flex-direction: column;
  .loginContent{
    flex: 1;
    width: 100%;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: 0 10% 32px 0;
    min-height: 0;
  }
  /* 右侧登录卡片 */
  .loginCon{
    width: 420px;
    flex-shrink: 0;
    padding: 44px 40px 36px;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(13, 42, 76, 0.12);
    .tit{
      font-size: 24px;
      padding-bottom: 26px;
      margin: 0;
      font-weight: 600;
      color: #0B5CAD;
    }
    .note{
      color: rgba(0, 0, 0, 0.45);
      font-size: 12px;
      margin: 14px 0 4px;
    }
  }
  .loginCon{
    .el-input__wrapper{
      padding: 4px 12px;
    }
    .el-input__inner{
      height: 40px;
      line-height: 40px;
    }
    .el-input__prefix,
    .el-input__suffix{
      height: 40px;
    }
    .login-btn{
      height: 48px;
      padding: 0 20px;
      line-height: 1;
      font-size: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .restore-btn{
      height: auto;
      padding: 0;
      font-size: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
    }
  }

 }
 @media (max-width: 860px) {
  .loginMain .loginContent{
    justify-content: center;
    padding: 16px 20px 24px;
  }
 }
</style>
