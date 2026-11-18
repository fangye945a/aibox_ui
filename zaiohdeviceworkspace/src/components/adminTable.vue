<template>
<div class="admin-table">
<el-table :data="tableData.data" stripe  style="width: 100%"
 header-row-class-name='tableTop' v-loading='tableData.isLoad' :height='hei'
 @selection-change="handleSelectionChange">
 <template #empty v-if='tableData.data.length==0'>
     <div class="table-empty">暂无数据</div>
 </template>
    <el-table-column type="index" label='序号' width="85" v-if="isIndex"></el-table-column>
    <el-table-column
      v-if="multi"
      type="selection"
      width="65" :selectable='tableData.selectable'>
    </el-table-column>
    <template  v-for="(item,i) in tableData.colList" :key='i' >
        <el-table-column
          :show-overflow-tooltip="true"
          :label="item.label"
          :width="item.width" :min-width='item.minWidth||"120px"' :align='item.align'>
            <template  #default="{ row, $index }">
                <slot :name="item.slot" :row="row" :index="$index"></slot>
                <template v-if='!item.slot'>
                  <template v-if="item.html"><div v-html='row[item.value]' @click='getActive(item,row)'></div></template>
                  <template v-else>{{row[item.value]}}</template>
                </template>
            </template>
        </el-table-column> 
    </template>
    <slot></slot>
  </el-table>
   <template v-if="showPage">
        <commonPagination :pagination="pagination"
              @pageSizeChangeHandle="handleSizeChange"
              @pageChangeHandle="handleCurrentChange">
        </commonPagination>
   </template>
</div>
</template>
<script setup>
import {ref, reactive , watch} from "vue";
import commonPagination from '@/components/commonPagination.vue';
  const pagination=reactive({
            total: 0,
            pageNum: 1,
            pageSize: 10
        })
  const props = defineProps({
          tableData: {
              type: Object,
              default: () => ({})
          },
          showPage:{
            type:Boolean,
            default: false
          },
          multi:{
            type:Boolean,
            default:false
          },
          isIndex:{
            type:Boolean,
            default:false
          },
          height:{
            type:String,
            default:'auto'
          }
  })
  const isLoad = ref(true)
  const hei=ref('auto')

  const init=()=>{
    isLoad.value = false;
    if(props.tableData.data.length>0){
      hei.value=props.height||'auto'
    }else{
      hei.value='280px'
    }

  }

  const selectList=ref([])
  const handleSelectionChange=(val)=>{
        selectList.value=val
  }

  const handleSizeChange=(val)=> {
        pagination.pageSize=val;
        props.tableData.click()
    }
    const handleCurrentChange=(val)=> {
        pagination.pageNum=val;
         props.tableData.click()
    }


    defineExpose({pagination,selectList})
    //初始化
    init()
   
   watch(props.tableData,(news)=>{
    if(news){
      init()
    }
   },{deep:true})
</script>
<style lang="scss" >
.el-table{
   .table-empty{
    height:240px;
    display: flex;
    justify-content: center;
    align-items: center;
    width:100%;
   }
   .el-table__cell{
     padding:8px 0px;
     font-size: 14px;
     color:rgba(0, 0, 0, 0.6);
   }
   .cell{
    padding:0px 25px;
   }
  tr.tableTop{
    background: rgba(0, 124, 247, 0.05);
    th.el-table__cell{
      padding:8px 0px;
      background: rgba(0, 124, 247, 0.05);
      color:rgba(0, 0, 0, 0.9);
      
    }
  }
 
  .tableText{
    color:#007CF7;
    width: 80%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }
} 
</style>