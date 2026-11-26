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
            <el-button type="primary" @click="submitForm">保存</el-button>
          </span>
        </template>
      </el-dialog>
    </div>
</template>
<script setup>
import { changePwd } from "@/api/api.common";
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router';
const props = defineProps({
  showNeverRemind: { type: Boolean, default: false },
  currentPassword: { type: String, default: '' }
});
const router = useRouter();
const dialogVisible = ref(false)
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
    localStorage.setItem('defaultPasswordPromptDisabled', 'true');
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

const submitForm=()=>{
    if (props.currentPassword) {
      form.current_password = props.currentPassword;
    }
    formRef.value.validate((valid) => {
        if(valid){
        let params={
          current_password:rsaEncrypt(form.current_password),
          new_password:rsaEncrypt(form.new_password)
        }

        changePwd(params).then((data)=>{
            ElMessage.success('修改成功')
            dialogVisible.value = false
            resetForm()
            emit('close')
            localStorage.removeItem('loginToken');
            router.replace({name: 'login'});
        })

        }else{ }
    })
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
