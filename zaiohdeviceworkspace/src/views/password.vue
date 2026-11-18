<template>
  <div class="passwordCon">
    <searchBar />
    <p class="note"><el-icon color='#007CF7' size='17'><InfoFilled /></el-icon>&nbsp;请注意保护好您的本地控制台登录密码，定期修改。</p>
    <div class="updpwd">
            <div class="pwd-row">
              <p class="pwd-con">当前密码：</p>
              <el-input v-model="currentPassword" type="password" show-password clearable style="width: 240px" placeholder="请输入当前密码"></el-input>
            </div>
            <el-button type="primary" class="old-pwd-btn" :loading="verifying" @click="openDialog">修改密码</el-button>
    </div>
    <up-pwd ref="pwdDialog" :current-password="currentPassword" @close="handleDialogClose"></up-pwd>
      
  </div>
       
</template>
<script setup>
import upPwd from './upPwd.vue'
import {InfoFilled} from '@element-plus/icons-vue'
import { verifyPassword } from '@/api/api.common'
import { ElMessage } from 'element-plus'
const pwdDialog = ref(null)
const currentPassword = ref('')
const verifying = ref(false)
const handleDialogClose = () => {
  currentPassword.value = ''
}
const openDialog = async () => {
  if (!currentPassword.value) {
    ElMessage.warning('请输入当前密码')
    return
  }
  if (verifying.value) return
  verifying.value = true
  try {
    await verifyPassword({current_password: currentPassword.value})
    pwdDialog.value.open(currentPassword.value)
  } catch (error) {
    ElMessage.error('当前密码验证失败，请检查密码')
  } finally {
    verifying.value = false
  }
}
</script>
 <style lang='scss'>
 .passwordCon{
  background: #FFFFFF;
  padding: 10px;
  border-radius: 12px;
  min-height:500px;
  .note{
    background:#F0F6FE ;
    border-radius: 6px;
    padding:15px;
    color:rgba(0,0,0,.9);
    display: flex;
    align-items: center;
  }
  
  .btn{
    text-align: center;
    padding-top: 20px;
  }
  .updpwd{
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: calc(80vh - 200px); 
    gap: 10px;
  }
  .pwd-row{
    display: flex;
    align-items: center;
  }
  .pwd-con{
    font-weight: 400;
    font-size: 14px;
    color: rgba(0,0,0,0.6);
  }
 }
 </style>
