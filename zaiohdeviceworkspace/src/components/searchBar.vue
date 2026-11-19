<template>
  <div class="search-box">
    <p class="title"><span v-if="isBack" @click="goBack"><el-icon><Back /></el-icon>返回</span>{{title}}</p>
    
    <div v-if="searchCon.queryParams" class="searchCon">
      <!-- <el-form ref='froms' :model='curForm'> -->
       <template v-for='(item,i) in searchCon.queryParams' :key='i'>
              <el-select v-model="curForm[item.label]"  :placeholder="item.note"  class='margin-r-10' v-if="item.type=='select'" clearable
              :style='{"width":item.width||"150px"}' @change="item.isclick?item.click(curForm[item.label]):''">
                  <el-option
                          v-for="(obj,j) in item.children"
                          :key="j"
                          :label="item.options?obj[item.options.label]:obj.label"
                          :value="item.options?obj[item.options.value]:obj.value"> </el-option>
              </el-select>
              <el-input v-else-if="item.type=='text'"  class="margin-r-10" clearable
             style='width:140px' 
            :placeholder="item.note" v-model="curForm[item.label]">
           </el-input>
           <el-date-picker v-else-if="item.type=='daterange'"  class="margin-r-10" :clearable='false' style="vertical-align:bottom"
            v-model="curForm[item.label]"
            type="daterange"
            range-separator="-"
            start-placeholder="请选择日期" end-placeholder="请选择日期" value-format="YYYY-MM-DD"
            
          />
          <el-date-picker v-else-if="item.type=='date'"  class="margin-r-10"  style="vertical-align:bottom"
            v-model="curForm[item.label]"
            type="date" 
            placeholder="请选择日期" value-format="YYYY-MM-DD"
            
          />
          <slot v-else-if="item.type==='temp'" :name="item.label"></slot>
       </template>
       <el-button type="primary" @click='searchCon.click'><span>查询</span></el-button>
       <el-button @click="init(true)">重置</el-button>
      <!-- </el-form> -->
    </div>
    <div class="search-btn" v-if="searchCon.optBtn">
      <template v-for="(item,index) in searchCon.optBtn" :key="index">
          <el-button type="primary" class="margin-r-10" @click='item.click'><span>{{item.text}}</span></el-button>
      </template>
    </div>
    <slot></slot>
  </div>
</template>
<script setup>
import {ref, reactive , watch} from "vue";
import {Back} from '@element-plus/icons-vue'
import { useRoute ,useRouter} from "vue-router";
 const route=useRoute()
 const title=route.meta.title
const props = defineProps({
    // 查询栏配置
    searchCon: {
        type: Object,
        default: () => ({}),
    },
    isBack:{
        type:Boolean,
        default:false
    }
})
const curForm = reactive({
  
})
const router=useRouter()
const goBack=()=>{
    router.go(-1)
}

const init = (str) => {
        // 给表单绑定相关属性值
        if(props.searchCon.queryParams){
            props.searchCon.queryParams.forEach((item) => {
              if(str){//重置
                 curForm[item.label] =''
              }else{//赋值
                 curForm[item.label] = item.value||'';
              }
                
            
            });
        }
        
 }




 watch(props.searchCon,(news)=>{
  if(news){
    init()
  }
 },{deep:true})
//初始化
init()

defineExpose({curForm})

 
</script>
<style lang="scss">
  .search-box {
    // background: #fff;
    font-size: 13px;
    color:#000;
    margin-bottom: 10px;
    .title{
      font-size: 17px;
      padding-bottom: 12px;
      margin-bottom: 14px;
      border-bottom: 1px solid #EEE;
      font-weight: 600;
      color: rgba(0,0,0,0.9);
      line-height: 1.4;
      span{
        padding-right:20px;
        margin-right: 20px;
        border-right: 1px solid #c4c0c0;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
      }
    }
    .searchCon{
      padding-top:10px;
      .el-select{
        width:150px;
      }
    }
    .search-btn{
      margin-top: 16px;
    }
  }
</style>