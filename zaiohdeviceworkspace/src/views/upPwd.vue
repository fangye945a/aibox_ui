<template>
    <div class="upPwd">
        <el-dialog v-model="dialogVisible" title="修改密码"  @close="handleClose" width='500px' :close-on-click-modal="false">
         <el-form ref='formRef' :model='form' :rules='rules'  label-width='80px' size='large'>
             <el-form-item v-if="!currentPassword" label='当前密码' prop='current_password'>
                  <el-input type='password' v-model="form.current_password" show-password clearable placeholder='请输入当前密码'></el-input>
             </el-form-item>
             <el-form-item label='新密码' prop='new_password'  autocomplete='off'>
                  <el-input type='password' v-model="form.new_password" show-password clearable placeholder='请输入长度为8-20位的新密码' maxLength='20'></el-input>
             </el-form-item>
             <el-form-item label='确认密码' prop='checkPwd'  autocomplete='off'>
                  <el-input type='password' v-model="form.checkPwd" show-password clearable placeholder='请再次输入新密码' maxLength='20'></el-input>
             </el-form-item>
         </el-form>
          <template #footer>
          <span class="dialog-footer">
            <el-button v-if="showNeverRemind" @click="handleNeverRemind">不再提醒</el-button>
            <el-button @click="handleCancel">取消</el-button>
            <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
          </span>
        </template>
      </el-dialog>
    </div>
</template>
<script setup>
import { storage } from '@/demo/storage';
import { changePwd } from "@/api/api.common";
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router';
const props = defineProps({
  showNeverRemind: { type: Boolean, default: false },
  currentPassword: { type: String, default: '' }
});
const router = useRouter();
const dialogVisible = ref(false)
const saving = ref(false);
const resetForm = () => {
  formRef.value?.resetFields();
};
const handleCancel = () => {
    resetForm()
    dialogVisible.value = false
    emit('close')
}
const handleClose = () => {
    resetForm()
    emit('close')
}
const handleNeverRemind = () => {
    storage.setItem('defaultPasswordPromptDisabled', 'true');
    dialogVisible.value = false;
    resetForm();
    emit('never-remind');
}

const formRef=ref()
var checkOld=(rules,value,callback)=>{
            if(value===''){
            return callback(new Error('请输入当前密码'))
          }
          callback();
}
var pass1=(rules,value,callback)=>{
            if(value===''){
              callback(new Error('请输入新密码'));
            }else if(value.length<8){
              callback(new Error('密码长度至少8位'));
            }else{
              
              if(form.checkPwd!==''){
              formRef.value.validateField('checkPwd');
              }
            callback();
            }
        }
var pass2=(rules,value,callback)=>{
          if(value===''){
            callback(new Error('请再次输入密码'));
          }else if(value !==form.new_password){
            callback(new Error('两次输入密码不一致'));
          }else{
            callback();
          }
} 
const form=reactive({
                    current_password:'',
                    new_password:'',
                    checkPwd:''
                  })
const  rules={
    current_password:[
        {required: true,validator:checkOld,message:'请输入当前密码',trigger:'blur'}
    ],
    new_password:[
        {required: true,validator:pass1,trigger:'blur'}
    ],
    checkPwd:[
        {required: true,validator:pass2,trigger:'blur'}
    ]
}  

//加密
const rsaEncrypt = data => data;

async function submitForm() {
  if (saving.value || !formRef.value) {
    return;
  }
  saving.value = true;
  try {
    await formRef.value.validate();
    await changePwd({
      current_password: rsaEncrypt(props.currentPassword || form.current_password),
      new_password: rsaEncrypt(form.new_password)
    });
    ElMessage.success('演示密码修改成功，请用新密码登录');
    dialogVisible.value = false;
    resetForm();
    storage.removeItem('loginToken');
    await router.replace({name: 'login'});
  } catch {
    // 校验和接口分别显示错误。
  } finally {
    saving.value = false;
  }
}
const emit = defineEmits(['close', 'never-remind'])
defineExpose({
  dialogVisible,
  open: (password = '') => {
    form.current_password = password;
    dialogVisible.value = true;
  }
})
</script>
<style scoped>
.upPwd{
}
.el-form{
    padding:30px;
    margin:0px auto;
}
.el-dialog__footer{
    width: 100%;
    border-top:1px solid #eee ;
    padding: 10px 0px;
}
.el-dialog__header.show-close{
    width: 100%;
    border-bottom:1px solid #eee ;
    padding: 10px 0px;
}

</style>
